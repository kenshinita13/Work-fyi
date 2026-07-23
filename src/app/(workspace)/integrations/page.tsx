import {
  CalendarDays,
  Check,
  FileText,
  Mail,
  ShieldCheck,
  Table2,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleConnectionActions } from "@/components/integrations/google-connection-actions";
import { GoogleDriveBrowser } from "@/components/integrations/google-drive-browser";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import { isGoogleConfigured } from "@/lib/env/server";
import { getGooglePickerEnv, isGooglePickerConfigured } from "@/lib/env/public";
import {
  GOOGLE_CORE_SCOPES,
  GOOGLE_GMAIL_SCOPES,
  hasGoogleScopes,
} from "@/lib/integrations/google/scopes";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getWorkspaceContext();
  if (!context?.workspace || !context.membership) redirect("/onboarding");
  const configured = isGoogleConfigured();
  const pickerConfigured = isGooglePickerConfigured();
  const pickerEnv = pickerConfigured ? getGooglePickerEnv() : null;
  const params = await searchParams;
  const { data: integration } = await getSupabaseAdminClient()
    .from("user_integrations")
    .select(
      "id,account_email,display_name,scopes,status,connected_at,last_refreshed_at,last_error_code",
    )
    .eq("workspace_id", context.workspace.id)
    .eq("user_id", context.claims.sub)
    .eq("provider", "google")
    .maybeSingle();
  const coreEnabled = Boolean(
    integration && hasGoogleScopes(integration.scopes, GOOGLE_CORE_SCOPES),
  );
  const gmailEnabled = Boolean(
    integration && hasGoogleScopes(integration.scopes, GOOGLE_GMAIL_SCOPES),
  );

  const capabilities = [
    {
      icon: CalendarDays,
      title: "Calendar",
      detail: "Read upcoming events from your primary calendar.",
      enabled: coreEnabled,
      href: "/calendar",
    },
    {
      icon: FileText,
      title: "Drive, Docs, and Slides",
      detail:
        "Browse app-authorized files and publish confirmed documents or presentations.",
      enabled: coreEnabled,
      href: "/documents",
    },
    {
      icon: Table2,
      title: "Sheets",
      detail: "Publish and explicitly synchronize Work.fyi spreadsheets.",
      enabled: coreEnabled,
      href: "/documents",
    },
    {
      icon: Mail,
      title: "Gmail",
      detail: "Summarize selected messages and create reviewed drafts.",
      enabled: gmailEnabled,
      href: "/email",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl py-6">
      <header className="flex flex-wrap items-start gap-4 px-4 sm:px-6">
        <div className="min-w-64 flex-1">
          <h1 className="text-2xl font-semibold">Integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your own Google account to this workspace.
          </p>
        </div>
        {integration && <GoogleConnectionActions />}
      </header>

      <div className="mt-6 border-y">
        {!configured ? (
          <div className="px-4 py-6 sm:px-6">
            <Alert>
              <ShieldCheck className="size-4" aria-hidden="true" />
              <AlertTitle>Google Cloud setup required</AlertTitle>
              <AlertDescription>
                Add the server-side Google OAuth client, callback URL, and
                encryption key before accounts can connect. No token will be
                accepted or stored until all four values pass validation.
              </AlertDescription>
            </Alert>
          </div>
        ) : integration ? (
          <div className="flex flex-wrap items-center gap-4 px-4 py-5 sm:px-6">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              G
            </span>
            <div className="min-w-56 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">
                  {integration.display_name || "Google Workspace"}
                </h2>
                <Badge
                  variant={
                    integration.status === "active"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {integration.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {integration.account_email}
              </p>
            </div>
            {!coreEnabled && (
              <Button asChild>
                <a href="/api/integrations/google/connect?capability=core">
                  Enable Calendar, Drive, Docs, Sheets, and Slides
                </a>
              </Button>
            )}
            {!gmailEnabled && (
              <Button variant="outline" asChild>
                <a href="/api/integrations/google/connect?capability=gmail">
                  Enable Gmail
                </a>
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 px-4 py-6 sm:px-6">
            <div className="min-w-64 flex-1">
              <h2 className="font-semibold">Google Workspace</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Start with Calendar and file-specific Drive access. Gmail is
                requested separately when you choose to use it.
              </p>
            </div>
            <Button asChild>
              <a href="/api/integrations/google/connect?capability=core">
                Connect Google Workspace
              </a>
            </Button>
          </div>
        )}
      </div>

      {(params.connected || params.error) && (
        <div className="px-4 pt-5 sm:px-6">
          <Alert variant={params.error ? "destructive" : "default"}>
            <AlertTitle>
              {params.error
                ? "Google connection was not completed"
                : "Google Workspace connected"}
            </AlertTitle>
            <AlertDescription>
              {params.error
                ? "Review the Google Cloud configuration and consent screen, then try again."
                : "The granted capabilities are ready to use."}
            </AlertDescription>
          </Alert>
        </div>
      )}

      <section className="px-4 py-7 sm:px-6">
        <h2 className="font-semibold">Capabilities</h2>
        <div className="mt-4 grid border sm:grid-cols-2">
          {capabilities.map(
            ({ icon: Icon, title, detail, enabled, href }, index) => (
              <div
                key={title}
                className={`flex gap-3 p-4 ${index % 2 === 0 ? "sm:border-r" : ""} ${index < 2 ? "border-b" : ""}`}
              >
                <Icon
                  className="mt-0.5 size-4 text-muted-foreground"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{title}</h3>
                    {enabled && (
                      <Check
                        className="size-3.5 text-primary"
                        aria-label="Enabled"
                      />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                  {enabled && (
                    <Link
                      className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
                      href={href}
                    >
                      Open
                    </Link>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </section>

      {coreEnabled && (
        <GoogleDriveBrowser
          pickerApiKey={pickerEnv?.apiKey}
          projectNumber={pickerEnv?.projectNumber}
        />
      )}
    </div>
  );
}
