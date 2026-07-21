import { describe, expect, it } from "vitest";

import { getSafeRedirectPath } from "@/lib/auth/redirect";
import { onboardingSchema, registrationSchema } from "@/lib/validation/auth";

describe("authentication validation", () => {
  it("accepts a complete registration", () => {
    expect(
      registrationSchema.safeParse({
        fullName: "Avery Morgan",
        email: "avery@example.com",
        password: "correct-horse",
        confirmPassword: "correct-horse",
      }).success,
    ).toBe(true);
  });

  it("rejects mismatched passwords", () => {
    const result = registrationSchema.safeParse({
      fullName: "Avery Morgan",
      email: "avery@example.com",
      password: "correct-horse",
      confirmPassword: "different-password",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });

  it("accepts the supported onboarding choices", () => {
    expect(
      onboardingSchema.safeParse({
        fullName: "Avery Morgan",
        workspaceName: "Northstar Operations",
        primaryRole: "project_manager",
        primaryUseCase: "project_management",
        timezone: "Asia/Singapore",
      }).success,
    ).toBe(true);
  });
});

describe("getSafeRedirectPath", () => {
  it("keeps local paths", () => {
    expect(getSafeRedirectPath("/dashboard?view=today")).toBe(
      "/dashboard?view=today",
    );
  });

  it("rejects external and protocol-relative redirects", () => {
    expect(getSafeRedirectPath("https://example.com")).toBe("/dashboard");
    expect(getSafeRedirectPath("//example.com")).toBe("/dashboard");
  });
});
