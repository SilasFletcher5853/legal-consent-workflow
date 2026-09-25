import { decideDelivery } from "../src/delivery_policy.ts";

const action = {
  kind: "signed_document_delivery" as const,
  documentReference: "signed-nda-1042",
};

console.log(JSON.stringify({
  afterGrant: decideDelivery(action, true),
  afterRevocation: decideDelivery(action, false),
}, null, 2));
