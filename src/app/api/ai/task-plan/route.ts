import { NextResponse, type NextRequest } from "next/server";

import { generateTaskPlan } from "@/lib/ai/task-planner";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getAiEnv } from "@/lib/env/server";
import { canManageProjects } from "@/lib/projects/permissions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiTaskPlanRequestSchema } from "@/lib/validation/ai-task-plan";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 16_384;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === request.nextUrl.origin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return errorResponse("Request rejected.", 403);

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_REQUEST_BYTES) {
    return errorResponse("Planning request is too large.", 413);
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_REQUEST_BYTES) {
    return errorResponse("Planning request is too large.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return errorResponse("Invalid request body.", 400);
  }

  const parsed = aiTaskPlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Check the planning request and try again.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) {
    return errorResponse("Sign in and choose a workspace to continue.", 401);
  }
  if (!canManageProjects(context.membership.role)) {
    return errorResponse("Your workspace role has read-only AI access.", 403);
  }

  const supabase = await createSupabaseServerClient();
  const projectId = parsed.data.projectId || null;
  const parentTaskId = parsed.data.parentTaskId || null;
  const [projectResult, parentTaskResult] = await Promise.all([
    projectId
      ? supabase
          .from("projects")
          .select("id, name, description")
          .eq("id", projectId)
          .eq("workspace_id", context.workspace.id)
          .neq("status", "archived")
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    parentTaskId
      ? supabase
          .from("tasks")
          .select("id, project_id, title, description, due_at")
          .eq("id", parentTaskId)
          .eq("workspace_id", context.workspace.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (projectId && !projectResult.data) {
    return errorResponse("Project not found.", 404);
  }
  if (parentTaskId && !parentTaskResult.data) {
    return errorResponse("Parent task not found.", 404);
  }
  if (
    projectId &&
    parentTaskResult.data?.project_id &&
    parentTaskResult.data.project_id !== projectId
  ) {
    return errorResponse("The parent task belongs to another project.", 400);
  }

  const effectiveProjectId =
    projectId ?? parentTaskResult.data?.project_id ?? null;
  let aiModel: string;
  try {
    aiModel = getAiEnv().aiModel.replace(/^openai\//, "");
  } catch {
    return errorResponse("AI planning has not been configured yet.", 503);
  }

  const admin = getSupabaseAdminClient();
  const { data: usageId, error: usageError } = await admin.rpc(
    "reserve_ai_task_plan_usage",
    {
      input_workspace_id: context.workspace.id,
      input_user_id: context.claims.sub,
      input_model: aiModel,
    },
  );

  if (usageError || !usageId) {
    if (usageError?.message.includes("AI_RATE_LIMIT")) {
      return errorResponse(
        "Too many plans were requested. Try again shortly.",
        429,
      );
    }
    if (usageError?.message.includes("AI_QUOTA_EXCEEDED")) {
      return errorResponse("This workspace has reached today's AI quota.", 429);
    }
    return errorResponse("AI planning is not available right now.", 503);
  }

  try {
    const generated = await generateTaskPlan({
      request: parsed.data,
      professionalRole: context.profile?.primary_role ?? null,
      primaryUseCase: context.profile?.primary_use_case ?? null,
      project: projectResult.data
        ? {
            name: projectResult.data.name,
            description: projectResult.data.description,
          }
        : null,
      parentTask: parentTaskResult.data
        ? {
            title: parentTaskResult.data.title,
            description: parentTaskResult.data.description,
            dueAt: parentTaskResult.data.due_at,
          }
        : null,
    });
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const { data: draft, error: draftError } = await admin
      .from("ai_task_plan_drafts")
      .insert({
        workspace_id: context.workspace.id,
        user_id: context.claims.sub,
        project_id: effectiveProjectId,
        parent_task_id: parentTaskId,
        mode: parsed.data.mode,
        plan: generated.plan as unknown as Json,
        expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (draftError || !draft) throw new Error("draft_insert_failed");

    await admin
      .from("ai_usage")
      .update({
        model: generated.modelId,
        input_tokens: generated.inputTokens,
        output_tokens: generated.outputTokens,
        status: "completed",
      })
      .eq("id", usageId);

    return NextResponse.json({
      draftId: draft.id,
      expiresAt,
      plan: generated.plan,
    });
  } catch {
    await admin.from("ai_usage").update({ status: "failed" }).eq("id", usageId);
    return errorResponse(
      "We could not generate a valid task plan. Please try again.",
      502,
    );
  }
}
