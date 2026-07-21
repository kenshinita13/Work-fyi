import { UserPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RegisterForm } from "@/components/auth/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWorkspaceContext } from "@/lib/auth/session";

export default async function RegisterPage() {
  const context = await getWorkspaceContext();

  if (context?.membership) redirect("/dashboard");
  if (context) redirect("/onboarding");

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <UserPlus className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Start with your identity, then set up a workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <RegisterForm />
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
