import { Globe, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/auth-forms";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { signInWithGoogleAction } from "@/lib/auth/actions";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { getWorkspaceContext } from "@/lib/auth/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const [params, context] = await Promise.all([
    searchParams,
    getWorkspaceContext(),
  ]);

  if (context?.membership) redirect("/dashboard");
  if (context) redirect("/onboarding");

  const next = getSafeRedirectPath(params.next);

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <LockKeyhole className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Sign in to continue to your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {params.error === "oauth" && (
          <Alert variant="destructive">
            <AlertDescription>
              Google sign-in could not start. Confirm the provider is enabled.
            </AlertDescription>
          </Alert>
        )}
        <form action={signInWithGoogleAction}>
          <Button variant="outline" className="w-full" type="submit">
            <Globe className="size-4" aria-hidden="true" />
            Continue with Google
          </Button>
        </form>
        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or use email</span>
          <Separator className="flex-1" />
        </div>
        <LoginForm next={next} />
        <div className="flex flex-col gap-3 text-center text-sm">
          <Link
            href="/auth/forgot-password"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot your password?
          </Link>
          <p className="text-muted-foreground">
            New to Work.fyi?{" "}
            <Link
              href="/auth/register"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
