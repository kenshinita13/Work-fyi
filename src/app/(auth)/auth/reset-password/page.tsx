import { KeyRound } from "lucide-react";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@/components/auth/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getVerifiedClaims } from "@/lib/auth/session";

export default async function ResetPasswordPage() {
  const claims = await getVerifiedClaims();
  if (!claims) redirect("/auth/forgot-password");

  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <KeyRound className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Use at least 8 characters and avoid a password you use elsewhere.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm />
      </CardContent>
    </Card>
  );
}
