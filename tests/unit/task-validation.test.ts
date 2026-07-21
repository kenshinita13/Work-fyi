import { describe, expect, it } from "vitest";

import {
  createTaskSchema,
  taskCommentSchema,
  taskFiltersSchema,
} from "@/lib/validation/task";
import { canChangeWorkspaceRole } from "@/lib/workspaces/permissions";

describe("task validation", () => {
  it("accepts a complete task", () => {
    expect(
      createTaskSchema.safeParse({
        title: "Review incident response plan",
        description: "Confirm owners and escalation paths.",
        status: "in_progress",
        priority: "high",
        projectId: "",
        assignedTo: "",
        parentTaskId: "",
        dueAt: "2026-07-24T09:30",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid task fields", () => {
    const result = createTaskSchema.safeParse({
      title: "A",
      description: "x".repeat(10001),
      status: "blocked",
      priority: "critical",
      projectId: "not-a-project",
      assignedTo: "",
      parentTaskId: "",
      dueAt: "not-a-date",
    });

    expect(result.success).toBe(false);
  });

  it("normalizes empty select sentinels", () => {
    const result = createTaskSchema.parse({
      title: "Prepare notes",
      description: "",
      status: "todo",
      priority: "medium",
      projectId: "none",
      assignedTo: "none",
      parentTaskId: "",
      dueAt: "",
    });

    expect(result.projectId).toBe("");
    expect(result.assignedTo).toBe("");
  });

  it("validates comments and defaults filters", () => {
    expect(
      taskCommentSchema.safeParse({
        taskId: crypto.randomUUID(),
        body: "Ready.",
      }).success,
    ).toBe(true);
    expect(
      taskCommentSchema.safeParse({ taskId: crypto.randomUUID(), body: "" })
        .success,
    ).toBe(false);
    expect(taskFiltersSchema.parse({})).toMatchObject({
      status: "current",
      priority: "all",
      scope: "all",
      view: "list",
    });
  });
});

describe("workspace role management", () => {
  it("lets owners manage non-owner roles", () => {
    expect(canChangeWorkspaceRole("owner", "member", "admin")).toBe(true);
  });

  it("limits admins to member and viewer changes", () => {
    expect(canChangeWorkspaceRole("admin", "member", "viewer")).toBe(true);
    expect(canChangeWorkspaceRole("admin", "admin", "viewer")).toBe(false);
    expect(canChangeWorkspaceRole("admin", "member", "admin")).toBe(false);
  });

  it("protects workspace ownership", () => {
    expect(canChangeWorkspaceRole("owner", "owner", "admin")).toBe(false);
    expect(canChangeWorkspaceRole("owner", "admin", "owner")).toBe(false);
  });
});
