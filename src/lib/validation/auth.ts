import { z } from "zod";

const emailSchema = z
  .email("Enter a valid email address.")
  .max(254, "Email address is too long.");

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password must be 72 characters or fewer.");

function isValidTimezone(value: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const registrationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name.")
      .max(100, "Name must be 100 characters or fewer."),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const primaryRoleSchema = z.enum([
  "virtual_assistant",
  "freelancer",
  "cybersecurity_specialist",
  "project_manager",
  "administrator",
  "other",
]);

export const primaryUseCaseSchema = z.enum([
  "virtual_assistance",
  "freelancing",
  "cybersecurity",
  "project_management",
  "administration",
  "personal_productivity",
]);

export const onboardingSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(100, "Name must be 100 characters or fewer."),
  workspaceName: z
    .string()
    .trim()
    .min(2, "Enter a workspace name.")
    .max(80, "Workspace name must be 80 characters or fewer."),
  primaryRole: primaryRoleSchema,
  primaryUseCase: primaryUseCaseSchema,
  timezone: z
    .string()
    .trim()
    .min(1, "Choose a time zone.")
    .max(100, "Time zone is too long.")
    .refine(isValidTimezone, "Enter a valid IANA time zone."),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
