import { describe, expect, it } from "vitest";

import {
  canEditDocument,
  canManageDocumentSharing,
} from "@/lib/documents/permissions";

const document = {
  uploadedBy: "owner-user",
  visibility: "restricted" as const,
};

describe("document permissions", () => {
  it("lets owners and admins manage restricted documents", () => {
    expect(canEditDocument("owner", "other-user", document, null)).toBe(true);
    expect(canEditDocument("admin", "other-user", document, null)).toBe(true);
  });

  it("requires editor sharing for a member on a restricted document", () => {
    expect(canEditDocument("member", "member-user", document, "viewer")).toBe(
      false,
    );
    expect(canEditDocument("member", "member-user", document, "editor")).toBe(
      true,
    );
  });

  it("keeps workspace viewers read-only even with an editor share", () => {
    expect(canEditDocument("viewer", "viewer-user", document, "editor")).toBe(
      false,
    );
  });

  it("only lets contributors share documents they own", () => {
    expect(canManageDocumentSharing("member", "owner-user", "owner-user")).toBe(
      true,
    );
    expect(canManageDocumentSharing("member", "other-user", "owner-user")).toBe(
      false,
    );
  });
});
