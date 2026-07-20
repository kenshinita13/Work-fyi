import { describe, expect, it } from "vitest";

import { aiTaskPlanSchema } from "@/lib/validation/ai";

describe("aiTaskPlanSchema", () => {
  it("accepts reviewed structured task plans", () => {
    expect(
      aiTaskPlanSchema.parse({
        title: "Prepare web application for production deployment",
        description:
          "Complete security, configuration, testing, and deployment checks.",
        priority: "high",
        estimatedEffort: "1-2 days",
        subtasks: [{ title: "Review production environment variables" }],
      }),
    ).toMatchObject({
      priority: "high",
      subtasks: [{ title: "Review production environment variables" }],
    });
  });

  it("rejects oversized AI task plans", () => {
    expect(() =>
      aiTaskPlanSchema.parse({
        title: "Prepare",
        priority: "urgent",
        subtasks: Array.from({ length: 21 }, (_, index) => ({
          title: `Subtask ${index}`,
        })),
      }),
    ).toThrow();
  });
});
