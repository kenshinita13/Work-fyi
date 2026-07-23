import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleCalendarEvents } from "@/components/integrations/google-calendar-events";
import { Button } from "@/components/ui/button";
import { getWorkspaceContext } from "@/lib/auth/session";
import {
  GOOGLE_CORE_SCOPES,
  hasGoogleScopes,
} from "@/lib/integrations/google/scopes";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function CalendarPage() {
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
    hasGoogleScopes(integration.scopes, [GOOGLE_CORE_SCOPES[0]]),
  );

  return (
    <div className="mx-auto w-full max-w-6xl py-6">
      <header className="flex items-start gap-3 px-4 sm:px-6">
        <CalendarDays className="mt-1 size-5 text-primary" aria-hidden="true" />
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upcoming events from your primary Google Calendar.
          </p>
        </div>
      </header>
      <section className="mt-6 border-y">
        {enabled ? (
          <GoogleCalendarEvents />
        ) : (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <CalendarDays
              className="size-9 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="mt-3 font-semibold">Connect Google Calendar</h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Calendar access is read-only and belongs to your individual
              Work.fyi account.
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
