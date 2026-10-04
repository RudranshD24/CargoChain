import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiException } from "../src/lib/api";

describe("Frontend API Client & Error Handling", () => {
  it("properly constructs ApiException instances", () => {
    const err = new ApiException("UNAUTHENTICATED", "Token expired", 401, { reason: "signature_expired" });
    assert.equal(err.name, "ApiException");
    assert.equal(err.code, "UNAUTHENTICATED");
    assert.equal(err.statusCode, 401);
    assert.equal(err.message, "Token expired");
    assert.deepEqual(err.details, { reason: "signature_expired" });
  });

  it("handles forbidden errors for unauthorized role actions", () => {
    const err = new ApiException("FORBIDDEN", "Role Transporter not authorized for this action", 403);
    assert.equal(err.statusCode, 403);
    assert.equal(err.code, "FORBIDDEN");
  });

  it("handles entity not found errors", () => {
    const err = new ApiException("NOT_FOUND", "Shipment with ID 999 not found", 404);
    assert.equal(err.statusCode, 404);
    assert.equal(err.code, "NOT_FOUND");
  });
});
