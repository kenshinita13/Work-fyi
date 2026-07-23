import { Mail } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleMailWorkspace } from "@/components/integrations/google-mail-workspace";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import {
  GOOGLE_GMAIL_SCOPES,
  hasGoogleScopes,
} from "@/lib/integrations/google/scopes";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function EmailPage() {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");
  const { data: integration } = await getSupabaseAdminClient()
    .from("user_integrations")
    .select("scopes,status")
    .eq("workspace_id", context.workspace.id)
    .eq("user_id", context.claims.sub)
    .eq("provider", "google")
    .maybeSingle();
  const enabled = Boolean(
    integration?.status === "active" &&
    hasGoogleScopes(integration.scopes, GOOGLE_GMAIL_SCOPES),
  );

  return (
    <div className="mx-auto w-full max-w-7xl py-6">
      <header className="flex items-start gap-3 px-4 sm:px-6">
        <Mail className="mt-1 size-5 text-primary" aria-hidden="true" />
        <div>
          <h1 className="text-2xl font-semibold">Email</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review selected Gmail messages and prepare drafts without sending.
          </p>
        </div>
      </header>
      <section className="mt-6 border-y">
        {enabled ? (
          <GoogleMailWorkspace />
        ) : (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <Mail className="size-9 text-muted-foreground" aria-hidden="true" />
            <h2 className="mt-3 font-semibold">Enable Gmail</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Gmail permissions are requested separately because they provide
              access to private message content.
            </p>
            <Button className="mt-5" asChild>
              <Link href="/integrations">Open integrations</Link>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
