import { Mail } from "lucide-react";
import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/auth-forms";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-md bg-primary/15 text-primary">
          <Mail className="size-5" aria-hidden="true" />
        </div>
        <CardTitle>Recover your account</CardTitle>
        <CardDescription>
          We will send a secure password reset link to your email.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <ForgotPasswordForm />
        <Link
          href="/auth/login"
          className="text-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to sign in
        </Link>
      </CardContent>
    </Card>
  );
}
