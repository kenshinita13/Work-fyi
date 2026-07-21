import { Layers3 } from "lucide-react";
import { redirect } from "next/navigation";

import { OnboardingForm } from "@/components/auth/onboarding-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/auth/session";

export default async function OnboardingPage() {
  const context = await getWorkspaceContext();

  if (!context) redirect("/auth/login?next=/onboarding");
  if (context.membership) redirect("/dashboard");

  const metadataName =
    typeof context.claims.user_metadata?.full_name === "string"
      ? context.claims.user_metadata.full_name
      : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground sm:px-8">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex items-center gap-3 text-sm font-semibold">
          <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Layers3 className="size-5" aria-hidden="true" />
          </span>
          Work.fyi
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Set up your workspace</CardTitle>
            <CardDescription>
              This creates your private workspace and makes you its owner.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm
              defaultFullName={context.profile?.full_name ?? metadataName}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
