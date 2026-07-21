import { redirect } from "next/navigation";

import { getWorkspaceContext } from "@/lib/auth/session";

export default async function Home() {
  const context = await getWorkspaceContext();

  if (!context) redirect("/auth/login");
  if (!context.membership) redirect("/onboarding");
  redirect("/dashboard");
}
