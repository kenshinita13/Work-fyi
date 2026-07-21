import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { getWorkspaceContext } from "@/lib/auth/session";
import { canManageProjects } from "@/lib/projects/permissions";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await getWorkspaceContext();

  if (!context) redirect("/auth/login?next=/dashboard");
  if (!context.membership || !context.workspace) redirect("/onboarding");

  const userEmail =
    typeof context.claims.email === "string"
      ? context.claims.email
      : "Signed-in user";
  const userName = context.profile?.full_name || userEmail.split("@")[0];

  return (
    <AppShell
      workspaceName={context.workspace.name}
      userName={userName}
      userEmail={userEmail}
      canCreateProject={canManageProjects(context.membership.role)}
    >
      {children}
    </AppShell>
  );
}
