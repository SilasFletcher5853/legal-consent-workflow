import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import { createConsentClient, InfraiError } from "./consent_client.ts";
import { decideDelivery } from "./delivery_policy.ts";

const legalActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("matter_intake"), matterReference: z.string().min(1) }),
  z.object({ kind: z.literal("signed_document_delivery"), documentReference: z.string().min(1) }),
  z.object({ kind: z.literal("deadline_follow_up"), matterReference: z.string().min(1), dueOn: z.iso.date() }),
]);

const requestSchema = z.object({
  userId: z.string().min(1),
  operationId: z.string().min(1),
  consent: z.enum(["grant", "revoke", "keep"]),
  action: legalActionSchema,
});

const consentCategory = "legal_matter_communications";

function send(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");
const infrai = createConsentClient(apiKey);

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/legal-workflow") {
    send(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const input = requestSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));

    if (input.consent === "grant") {
      await infrai.auth.consent.grant(input.userId, consentCategory, "legal_workflow", input.operationId);
    } else if (input.consent === "revoke") {
      await infrai.auth.consent.revoke(input.userId, consentCategory, input.operationId);
    }

    const checked = z.object({ result: z.boolean() }).parse(
      await infrai.auth.consent.check(input.userId, consentCategory),
    );
    const decision = decideDelivery(input.action, checked.result);
    send(response, decision.allowed ? 200 : 403, decision);
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      send(response, 400, { error: "invalid_request" });
    } else if (error instanceof InfraiError && error.status >= 400 && error.status < 500) {
      send(response, error.status, { error: error.code });
    } else {
      send(response, 502, { error: "upstream_request_failed" });
    }
  }
});

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3000);
  server.listen(port, () => console.log(`Legal consent service listening on http://localhost:${port}`));
}
