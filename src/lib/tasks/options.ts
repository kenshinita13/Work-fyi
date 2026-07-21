import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getTaskOptions(workspaceId: string) {
  const supabase = await createSupabaseServerClient();
  const [projectsResult, membershipsResult] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name")
      .eq("workspace_id", workspaceId)
      .neq("status", "archived")
      .order("name"),
    supabase
      .from("workspace_members")
      .select("user_id, role")
      .eq("workspace_id", workspaceId),
  ]);

  const memberIds =
    membershipsResult.data?.map((member) => member.user_id) ?? [];
  const profilesResult = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds)
    : { data: [], error: null };
  const names = new Map(
    profilesResult.data?.map((profile) => [
      profile.id,
      profile.full_name || "Workspace member",
    ]),
  );

  return {
    projects: projectsResult.data ?? [],
    members:
      membershipsResult.data?.map((member) => ({
        id: member.user_id,
        name: names.get(member.user_id) ?? "Workspace member",
        role: member.role,
      })) ?? [],
    error:
      projectsResult.error ?? membershipsResult.error ?? profilesResult.error,
  };
}
