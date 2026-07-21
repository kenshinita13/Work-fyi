"use server";

import { redirect } from "next/navigation";

import type { FormState } from "@/lib/auth/form-state";
import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { getPublicEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  onboardingSchema,
  registrationSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

function validationError(error: {
  flatten: () => { fieldErrors: Record<string, string[] | undefined> };
}): FormState {
  const fieldErrors = Object.fromEntries(
    Object.entries(error.flatten().fieldErrors).filter(
      (entry): entry is [string, string[]] => Boolean(entry[1]?.length),
    ),
  );

  return {
    status: "error",
    message: "Check the highlighted fields and try again.",
    fieldErrors,
  };
}

export async function loginAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return {
      status: "error",
      message: "The email or password is incorrect.",
    };
  }

  redirect(getSafeRedirectPath(formData.get("next")?.toString()));
}

export async function registerAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = registrationSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createSupabaseServerClient();
  const callbackUrl = new URL("/auth/callback", getPublicEnv().appUrl);
  callbackUrl.searchParams.set("next", "/onboarding");

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: callbackUrl.toString(),
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    return {
      status: "error",
      message: "We could not create that account. Try another email.",
    };
  }

  if (data.session) {
    redirect("/onboarding");
  }

  return {
    status: "success",
    message: "Check your email to verify your account, then continue here.",
  };
}

export async function forgotPasswordAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createSupabaseServerClient();
  const callbackUrl = new URL("/auth/callback", getPublicEnv().appUrl);
  callbackUrl.searchParams.set("next", "/auth/reset-password");

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: callbackUrl.toString(),
  });

  return {
    status: "success",
    message:
      "If an account exists for that email, a recovery link is on its way.",
  };
}

export async function resetPasswordAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return {
      status: "error",
      message: "This recovery link is invalid or expired. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message:
        "We could not update your password. Request a new recovery link.",
    };
  }

  redirect("/dashboard");
}

export async function signInWithGoogleAction() {
  const supabase = await createSupabaseServerClient();
  const callbackUrl = new URL("/auth/callback", getPublicEnv().appUrl);
  callbackUrl.searchParams.set("next", "/dashboard");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl.toString() },
  });

  if (error || !data.url) {
    redirect("/auth/login?error=oauth");
  }

  redirect(data.url);
}

export async function completeOnboardingAction(
  _previousState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = onboardingSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return validationError(parsed.error);
  }

  const supabase = await createSupabaseServerClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims?.sub) {
    return { status: "error", message: "Sign in again to continue." };
  }

  const { error } = await supabase.rpc("complete_onboarding", {
    input_full_name: parsed.data.fullName,
    input_workspace_name: parsed.data.workspaceName,
    input_primary_role: parsed.data.primaryRole,
    input_primary_use_case: parsed.data.primaryUseCase,
    input_timezone: parsed.data.timezone,
  });

  if (error) {
    return {
      status: "error",
      message: "We could not finish workspace setup. Please try again.",
    };
  }

  redirect("/dashboard");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
