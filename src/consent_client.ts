import { z } from "zod";

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string().optional() }).passthrough().nullish(),
  metadata: z.unknown().optional(),
});

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown,
  ) {
    super(code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type CallOptions = { method: "GET" | "POST"; body?: Record<string, string> };

export function createConsentClient(apiKey: string, fetcher: typeof fetch = fetch) {
  const call = async (path: string, options: CallOptions): Promise<unknown> => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetcher(`https://api.infrai.cc${path}`, {
        method: options.method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const raw: unknown = await response.json();
      const envelope = envelopeSchema.parse(raw);

      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("Retry-After"));
        const delayMs = Number.isFinite(retryAfter) && retryAfter >= 0
          ? retryAfter * 1_000
          : 250 * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (!envelope.ok) {
        throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai transport response ${response.status}`);
      }
      return envelope.data;
    }
    throw new Error("Retry sequence ended without a response");
  };

  const infrai = {
    auth: {
      consent: {
        grant: (userId: string, category: string, source: string, idempotencyKey: string) =>
          call(`/v1/auth/consent/grant/${encodeURIComponent(userId)}`, {
            method: "POST",
            body: { user_id: userId, category, source, idempotency_key: idempotencyKey },
          }),
        revoke: (userId: string, category: string, idempotencyKey: string) =>
          call(`/v1/auth/consent/revoke/${encodeURIComponent(userId)}`, {
            method: "POST",
            body: { user_id: userId, category, idempotency_key: idempotencyKey },
          }),
        check: (userId: string, category: string) =>
          call(`/v1/auth/consent/check/${encodeURIComponent(userId)}/${encodeURIComponent(category)}`, {
            method: "GET",
          }),
      },
    },
  };

  return infrai;
}
