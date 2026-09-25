export type LegalAction =
  | { kind: "matter_intake"; matterReference: string }
  | { kind: "signed_document_delivery"; documentReference: string }
  | { kind: "deadline_follow_up"; matterReference: string; dueOn: string };

export function decideDelivery(action: LegalAction, consentGranted: boolean) {
  if (!consentGranted) {
    return { allowed: false as const, state: "consent_required" as const, action };
  }
  return { allowed: true as const, state: "ready" as const, action };
}
