# 07 Webhook Lambda and SQS (emulated AWS)

## Findings being fixed

`infra/sam/handlers/webhook.py` is a stub echo handler; SQS is only referenced inside that stub; the TS webhook worker does delivery directly.

## Target design

BullMQ `webhook` queue job -> publish message to SQS (LocalStack or ElasticMQ) -> Lambda (SAM local or LocalStack) signs with HMAC-SHA256 and POSTs to the subscriber -> non-2xx raises so SQS retries -> redrive to a DLQ after 5 receives.
(If you prefer fewer moving parts, keep BullMQ for delivery and delete the Lambda claim; do not keep a stub and claim Lambda.)

## Step 1: Publisher

`packages/queue/src/sqs.ts` using `@aws-sdk/client-sqs` with `SQS_ENDPOINT` override. Message body: `{ deliveryId, tenantId, url, event, payload, attempt }`. The BullMQ webhook worker publishes instead of calling `fetch` when `WEBHOOK_TRANSPORT=sqs`.

## Step 2: Lambda handler (Python)

```python
import hmac, hashlib, json, os, urllib.request

def handler(event, context):
    failures = []
    for rec in event["Records"]:
        try:
            msg = json.loads(rec["body"])
            body = json.dumps(msg["payload"], separators=(",", ":")).encode()
            sig = hmac.new(os.environ["WEBHOOK_SIGNING_SECRET"].encode(), body, hashlib.sha256).hexdigest()
            req = urllib.request.Request(msg["url"], data=body, method="POST", headers={
                "Content-Type": "application/json",
                "X-SupportPilot-Event": msg["event"],
                "X-SupportPilot-Delivery": msg["deliveryId"],
                "X-SupportPilot-Signature": f"sha256={sig}",
            })
            with urllib.request.urlopen(req, timeout=5) as r:
                if r.status >= 300: raise RuntimeError(f"status {r.status}")
        except Exception:
            failures.append({"itemIdentifier": rec["messageId"]})
    return {"batchItemFailures": failures}
```

- Enable `ReportBatchItemFailures` in the event source mapping.
- Block SSRF: reject URLs resolving to private IP ranges and non-http(s) schemes before sending (also validate at webhook registration time).
- Secret from environment (SSM parameter in Terraform), never hard-coded.
- Idempotency: include `deliveryId`; subscriber docs explain dedupe.

## Step 3: Tests

- pytest unit tests for signing and failure reporting with a local `http.server` fixture; use `moto` if mocking SQS.
- Sample event `infra/sam/events/sqs.json`; run `sam build; sam local invoke WebhookFunction -e infra/sam/events/sqs.json` and save output.
- Integration test: publish to LocalStack SQS, Lambda or poller delivers to a test receiver, signature verifies, a 500 receiver triggers retry then DLQ after 5 attempts (`T-HOOK-01`).

## Step 4: Terraform on LocalStack

`infra/terraform/sqs.tf`: queue, DLQ, redrive policy (`maxReceiveCount = 5`), queue policy; `lambda.tf`: function, role, event source mapping with batch size and `function_response_types = ["ReportBatchItemFailures"]`; `ssm.tf` for the signing secret. Use `tflocal` or provider endpoints:

```powershell
pip install terraform-local
tflocal init; tflocal apply -auto-approve
awslocal sqs list-queues
```

Save `tflocal plan` and `apply` output to `evidence/aws/`. Note LocalStack licensing may require an account/token; if unavailable, use ElasticMQ for SQS and `sam local` for Lambda, and keep Terraform plan-only (`terraform validate` plus `plan` with mock provider settings).

## Acceptance checklist

- [ ] Handler signs and delivers; failures reported per item.
- [ ] SQS publisher in the queue package; transport switchable.
- [ ] Retry and DLQ behaviour demonstrated and tested.
- [ ] Terraform applied against emulator (or clearly plan-only) with saved output.
- [ ] README states: runs on emulators, not real AWS.

## Resume gating

Allowed: "Webhook delivery via SQS and a Lambda handler (HMAC-signed, partial-batch failures, DLQ), developed with SAM local and Terraform on LocalStack". Not allowed: "deployed on AWS".
