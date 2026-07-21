"use client";

import { useActionState } from "react";

import {
  FieldError,
  FormFeedback,
  SubmitButton,
} from "@/components/auth/form-parts";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resetPasswordAction,
} from "@/lib/auth/actions";
import { initialFormState } from "@/lib/auth/form-state";

function Field({
  id,
  label,
  type = "text",
  autoComplete,
  errors,
}: {
  id: string;
  label: string;
  type?: React.HTMLInputTypeAttribute;
  autoComplete?: string;
  errors?: string[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={Boolean(errors?.length)}
        required
      />
      <FieldError errors={errors} />
    </div>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(loginAction, initialFormState);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next ?? "/dashboard"} />
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        errors={state.fieldErrors?.email}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        errors={state.fieldErrors?.password}
      />
      <FormFeedback state={state} />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, initialFormState);

  return (
    <form action={action} className="grid gap-4">
      <Field
        id="fullName"
        label="Full name"
        autoComplete="name"
        errors={state.fieldErrors?.fullName}
      />
      <Field
        id="email"
        label="Work email"
        type="email"
        autoComplete="email"
        errors={state.fieldErrors?.email}
      />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.password}
      />
      <Field
        id="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.confirmPassword}
      />
      <FormFeedback state={state} />
      <SubmitButton>Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(
    forgotPasswordAction,
    initialFormState,
  );

  return (
    <form action={action} className="grid gap-4">
      <Field
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        errors={state.fieldErrors?.email}
      />
      <FormFeedback state={state} />
      <SubmitButton>Send recovery link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPasswordAction, initialFormState);

  return (
    <form action={action} className="grid gap-4">
      <Field
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.password}
      />
      <Field
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        errors={state.fieldErrors?.confirmPassword}
      />
      <FormFeedback state={state} />
      <SubmitButton>Update password</SubmitButton>
    </form>
  );
}
