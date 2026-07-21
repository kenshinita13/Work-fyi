import { describe, expect, it } from "vitest";

import { escapeLikePattern } from "@/lib/projects/filters";
import { canManageProjects } from "@/lib/projects/permissions";
import {
  createProjectSchema,
  projectFiltersSchema,
} from "@/lib/validation/project";

describe("project validation", () => {
  it("accepts a complete project", () => {
    expect(
      createProjectSchema.safeParse({
        name: "Quarterly client reporting",
        description: "Build and review the reporting package.",
        status: "active",
      }).success,
    ).toBe(true);
  });

  it("rejects short names and oversized descriptions", () => {
    const result = createProjectSchema.safeParse({
      name: "A",
      description: "x".repeat(5001),
      status: "active",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.name).toBeDefined();
      expect(errors.description).toBeDefined();
    }
  });

  it("does not allow archived as an editable status", () => {
    expect(
      createProjectSchema.safeParse({
        name: "Archived directly",
        description: "",
        status: "archived",
      }).success,
    ).toBe(false);
  });

  it("falls back to current projects when filters are omitted", () => {
    expect(projectFiltersSchema.parse({})).toEqual({
      query: "",
      status: "current",
    });
  });
});

describe("project access helpers", () => {
  it("keeps viewers read only", () => {
    expect(canManageProjects("viewer")).toBe(false);
    expect(canManageProjects("member")).toBe(true);
    expect(canManageProjects("admin")).toBe(true);
  });

  it("escapes wildcard characters in name search", () => {
    expect(escapeLikePattern("100%_ready\\today")).toBe(
      "100\\%\\_ready\\\\today",
    );
  });
});
