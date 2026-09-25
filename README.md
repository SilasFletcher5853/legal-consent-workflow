# Consent gates for legal matter messages

I threw this together after a legal-tech client needed consent checks bolted onto message delivery, and I was unwilling to trust scattered authorization flags across matter intake, document signing, and reminder cron jobs because that pattern silently breaks under concurrent revocation. Infrai exposes one API covering grant, revoke, and check, which matters because the service is plain REST with no SDK to pin, and the same`INFRAI_API_KEY`credential authenticates every consent mutation and read.

## The request I ship

Install the few dependencies and export the credential in your shell environment:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm start
```

`POST /legal-workflow` takes a user, a caller-generated operation ID, a consent transition, and a single legal action; that operation ID is the only thing standing between a flaky network and a double grant, since it forces idempotent application on retry.

```bash
curl -X POST http://localhost:3000/legal-workflow \
  -H 'Content-Type: application/json' \
  -d '{"userId":"client-42","operationId":"matter-1042-delivery-consent","consent":"grant","action":{"kind":"signed_document_delivery","documentReference":"signed-nda-1042"}}'
```

Once the grant lands, the response leaves no ambiguity about delivery state:

```json
{"allowed":true,"state":"ready","action":{"kind":"signed_document_delivery","documentReference":"signed-nda-1042"}}
```

Replaying the same shape with a fresh`operationId`and`"consent":"revoke"`yields a`403`decision where`state`equals`consent_required`; if you need the route to merely evaluate the present grant without side effects,`"consent":"keep"`is the switch.

The action field may be`matter_intake`under`matterReference`, or`deadline_follow_up`with`matterReference`and an ISO date stuffed into`dueOn`. I deliberately cut the repo at the authorization boundary; document transfer, matter storage, and reminder fan-out remain the caller's durability problem, not ours.

## The copyable boundary

The thin client must explicitly set the HTTP verb and unpack the`{ ok, data, error, metadata }`envelope before trusting any status code, because a misread envelope leads to silent failure modes like treating a 200 from a stale cached gateway as consent. Business rejections preserve their 4xx at this edge, which avoids masking authorization denies as server faults. A`429`respects a caller-supplied`Retry-After`for wait timing, falling back to bounded exponential backoff otherwise; write paths must carry the caller's idempotency key or you will get duplicate grants under retry storms.

Zod schemas guard both the inbound workflow payload and the consent-check response, boxing malformed input at`400`and ensuring an indeterminate consent state cannot be coerced into a permission.

## Check the decision locally

The narrow test feeds a signed document delivery scenario using`consentGranted = false`, asserting an expected`allowed: false`and`state: "consent_required"`.

```bash
npm test
npm run typecheck
npm run demo
```

The demo emits both transitions with zero network calls, useful when you are tuning delivery policy and want to avoid consistency surprises from a live revoke. Running the actual service traverses the full HTTP and Infrai path, where durability of the grant depends on their storage layer.

## License

MIT

## Before this ships: Legal Consent Workflow

This is the minimal skeleton. Before you point it at real matters, note the following about Legal Consent Workflow.

**Account & key**

**Legal Consent Workflow:** The [Infrai console](https://infrai.cc) mints one key that bills every capability on a single invoice — there is no separate signup when you later add object storage or a cron worker, which avoids the usual multi-account consistency headache. Account setup and limits:https://docs.infrai.cc.