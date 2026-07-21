import { describe, expect, it } from "vitest";

import {
  aiTaskPlanRequestSchema,
  generatedTaskPlanSchema,
} from "@/lib/validation/ai-task-plan";

describe("AI task plan validation", () => {
  it("rejects oversized prompts before provider work", () => {
    const result = aiTaskPlanRequestSchema.safeParse({
      mode: "task_plan",
      prompt: "x".repeat(4001),
      projectId: "",
      parentTaskId: "",
    });

    expect(result.success).toBe(false);
  });

  it("requires a parent task for subtask generation", () => {
    const result = aiTaskPlanRequestSchema.safeParse({
      mode: "subtasks",
      prompt: "Break this outcome into small executable steps.",
      projectId: "",
      parentTaskId: "",
    });

    expect(result.success).toBe(false);
  });

  it("rejects prompts containing likely credentials", () => {
    const result = aiTaskPlanRequestSchema.safeParse({
      mode: "task_plan",
      prompt:
        "Use api_key=sk-proj-abcdefghijklmnopqrstuvwxyz12345 to plan this.",
      projectId: "",
      parentTaskId: "",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a bounded structured plan", () => {
    const result = generatedTaskPlanSchema.safeParse({
      title: "Prepare the client handoff",
      tasks: [
        {
          title: "Review deliverables",
          description:
            "Confirm each deliverable against the acceptance criteria.",
          priority: "high",
          dueInDays: 1,
          subtasks: [
            {
              title: "Check file permissions",
              description: "Verify the client can open each shared file.",
              priority: "medium",
              dueInDays: null,
            },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects unbounded or unsupported generated fields", () => {
    const result = generatedTaskPlanSchema.safeParse({
      title: "Unsafe plan",
      tasks: [
        {
          title: "Run action",
          description: "Do the thing.",
          priority: "critical",
          dueInDays: 999,
          subtasks: [],
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
