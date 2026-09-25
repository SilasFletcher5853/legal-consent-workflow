import assert from "node:assert/strict";
import test from "node:test";
import { decideDelivery } from "../src/delivery_policy.ts";

test("revocation blocks a signed document delivery", () => {
  const action = { kind: "signed_document_delivery" as const, documentReference: "signed-nda-1042" };

  assert.deepEqual(decideDelivery(action, false), {
    allowed: false,
    state: "consent_required",
    action,
  });
});
