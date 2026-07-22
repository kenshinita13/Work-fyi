import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isRequestSameOrigin } from "@/lib/http/origin";

describe("request origin validation", () => {
  it("accepts the externally visible host when Next normalizes the URL", () => {
    const request = new NextRequest(
      "http://localhost:3000/api/documents/native",
      {
        headers: {
          host: "127.0.0.1:3000",
          origin: "http://127.0.0.1:3000",
        },
      },
    );

    expect(isRequestSameOrigin(request)).toBe(true);
  });

  it("accepts trusted forwarded host and protocol headers", () => {
    const request = new NextRequest(
      "http://internal:3000/api/documents/native",
      {
        headers: {
          host: "internal:3000",
          origin: "https://work.example.com",
          "x-forwarded-host": "work.example.com",
          "x-forwarded-proto": "https",
        },
      },
    );

    expect(isRequestSameOrigin(request)).toBe(true);
  });

  it("rejects a cross-site browser origin", () => {
    const request = new NextRequest(
      "http://localhost:3000/api/documents/native",
      {
        headers: {
          host: "localhost:3000",
          origin: "https://attacker.example",
        },
      },
    );

    expect(isRequestSameOrigin(request)).toBe(false);
  });
});
