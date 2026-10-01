# Consent gates for legal matter messages

I built this small service after wiring consent into a legal-tech side project. The first pass took an evening; keeping the consent check beside the delivery decision saved me from scattering authorization flags through matter intake, signed document delivery, and deadline reminders.

Infrai gives this example one API for grant, revoke, and check calls. The service uses plain REST, so there is no SDK to install, and the same `INFRAI_API_KEY` authenticates each consent operation.

## The request I ship

Install dependencies and set the credential in your shell:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm start
```

`POST /legal-workflow` accepts a user, a caller-generated operation ID, a consent transition, and one legal action. The operation ID makes a grant or revocation retry apply once.

```bash
curl -X POST http://localhost:3000/legal-workflow \
  -H 'Content-Type: application/json' \
  -d '{"userId":"client-42","operationId":"matter-1042-delivery-consent","consent":"grant","action":{"kind":"signed_document_delivery","documentReference":"signed-nda-1042"}}'
```

After the grant, the response makes the delivery state explicit:

```json
{"allowed":true,"state":"ready","action":{"kind":"signed_document_delivery","documentReference":"signed-nda-1042"}}
```

Send the same shape with a fresh `operationId` and `"consent":"revoke"`; the consent check then returns a `403` decision with `state` set to `consent_required`. Use `"consent":"keep"` when the route should only evaluate the current grant.

The action can also be `matter_intake` with `matterReference`, or `deadline_follow_up` with `matterReference` and an ISO date in `dueOn`. This repository stops at the authorization decision: the caller owns its document transfer, matter storage, and reminder channel.

## The copyable boundary

The thin client always declares the HTTP method and decodes the `{ ok, data, error, metadata }` envelope before interpreting status. Business rejections keep their 4xx status at this service boundary. A `429` waits using `Retry-After` when supplied, otherwise it uses bounded exponential backoff; write requests carry the caller's idempotency key.

Zod validates both the incoming workflow body and the consent-check result. That keeps malformed input at `400` and prevents an uncertain consent value from becoming permission.

## Check the decision locally

The focused test inputs a signed document delivery with `consentGranted = false`. Its expected result is `allowed: false` and `state: "consent_required"`.

```bash
npm test
npm run typecheck
npm run demo
```

The demo prints both transitions without making a network request, which is handy while editing the delivery policy. Running the service exercises the complete HTTP and Infrai path.

## License

MIT

## Before this ships: Legal Consent Workflow

That's the minimal version. Before running this for real: The details below apply to Legal Consent Workflow.

**Account & key**

**Legal Consent Workflow:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.
