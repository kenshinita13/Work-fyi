import { ShieldCheck, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";

import { MemberRoleForm } from "@/components/team/member-role-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getWorkspaceContext } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canChangeWorkspaceRole } from "@/lib/workspaces/permissions";
import type { PrimaryRole, WorkspaceRole } from "@/types/database";

const professionalLabels: Record<PrimaryRole, string> = {
  virtual_assistant: "Virtual Assistant",
  freelancer: "Freelancer",
  cybersecurity_specialist: "Cybersecurity Analyst",
  project_manager: "Project Manager",
  administrator: "Administrator",
  other: "Other",
};

export default async function TeamPage() {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");

  const supabase = await createSupabaseServerClient();
  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("user_id, role, created_at")
    .eq("workspace_id", context.workspace.id)
    .order("created_at");
  const memberIds = memberships?.map((membership) => membership.user_id) ?? [];
  const { data: profiles } = memberIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name, primary_role")
        .in("id", memberIds)
    : { data: [] };
  const profileMap = new Map(profiles?.map((profile) => [profile.id, profile]));

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-sm text-muted-foreground">
            {context.workspace.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">Team</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Access roles define permissions. Professional categories tailor the
            work experience without changing access.
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5 font-normal">
          <ShieldCheck className="size-3.5 text-primary" aria-hidden="true" />
          Database enforced
        </Badge>
      </div>

      {error ? (
        <div className="mt-7 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Team members could not be loaded.
        </div>
      ) : memberships?.length ? (
        <div className="mt-7 overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Professional category</TableHead>
                <TableHead>Access role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {memberships.map((membership) => {
                const profile = profileMap.get(membership.user_id);
                const allowedRoles: Array<Exclude<WorkspaceRole, "owner">> =
                  context.membership.role === "owner"
                    ? ["admin", "member", "viewer"]
                    : ["member", "viewer"];
                const editable = allowedRoles.some((role) =>
                  canChangeWorkspaceRole(
                    context.membership.role,
                    membership.role,
                    role,
                  ),
                );

                return (
                  <TableRow key={membership.user_id}>
                    <TableCell>
                      <p className="font-medium">
                        {profile?.full_name || "Workspace member"}
                      </p>
                      {membership.user_id === context.claims.sub && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          You
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profile?.primary_role
                        ? professionalLabels[profile.primary_role]
                        : "Not selected"}
                    </TableCell>
                    <TableCell>
                      {editable ? (
                        <MemberRoleForm
                          userId={membership.user_id}
                          role={membership.role}
                          allowedRoles={allowedRoles}
                        />
                      ) : (
                        <Badge variant="secondary" className="capitalize">
                          {membership.role}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <section className="flex min-h-80 flex-col items-center justify-center text-center">
          <UsersRound
            className="mb-4 size-7 text-muted-foreground"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold">No team members found</h2>
        </section>
      )}
    </div>
  );
}
