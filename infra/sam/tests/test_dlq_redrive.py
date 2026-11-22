"""SQS DLQ Redrive and Retry lifecycle tests (T-HOOK-01).

Verifies that messages failing delivery after maxReceiveCount (5 attempts)
are routed to the Dead Letter Queue (DLQ) using genuine AWS SQS behavior via moto,
and can be recovered upon endpoint resolution.
"""

from __future__ import annotations

import json
from typing import Any

import boto3
import pytest
import yaml
from moto import mock_aws

from infra.sam.handlers.webhook import handler


class CloudFormationSafeLoader(yaml.SafeLoader):
    """YAML SafeLoader that ignores CloudFormation intrinsic function tags (!Ref, !GetAtt)."""


CloudFormationSafeLoader.add_multi_constructor(
    "!",
    lambda loader, suffix, node: (
        loader.construct_scalar(node)
        if isinstance(node, yaml.ScalarNode)
        else loader.construct_mapping(node)
        if isinstance(node, yaml.MappingNode)
        else loader.construct_sequence(node)
    ),
)


def test_sam_template_redrive_policy_attributes() -> None:
    """Verify SAM template configures maxReceiveCount = 5 on WebhooksQueue."""
    with open("infra/sam/template.yaml", "r", encoding="utf-8") as f:
        tpl = yaml.load(f, Loader=CloudFormationSafeLoader)

    webhooks_queue = tpl["Resources"]["WebhooksQueue"]["Properties"]
    redrive_policy = webhooks_queue["RedrivePolicy"]

    assert redrive_policy["maxReceiveCount"] == 5
    assert "deadLetterTargetArn" in redrive_policy


@mock_aws
def test_t_hook_01_dlq_redrive_after_5_failures(
    mock_webhook_server: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """T-HOOK-01: Verify SQS redrive policy routes failing messages to DLQ after 5 attempts."""
    monkeypatch.setenv("WEBHOOK_ALLOW_LOCAL", "true")
    monkeypatch.setenv("WEBHOOK_SIGNING_SECRET", "whsec_test_signing_secret_12345")
    # Endpoint returns 500 to trigger delivery failure
    mock_webhook_server.next_status_code = 500

    port = mock_webhook_server.server_address[1]
    target_url = f"http://127.0.0.1:{port}/flaky-endpoint"

    sqs = boto3.client("sqs", region_name="us-east-1")

    # 1. Create DLQ
    dlq_res = sqs.create_queue(QueueName="supportpilot-webhooks-dlq")
    dlq_url = dlq_res["QueueUrl"]
    dlq_attrs = sqs.get_queue_attributes(QueueUrl=dlq_url, AttributeNames=["QueueArn"])
    dlq_arn = dlq_attrs["Attributes"]["QueueArn"]

    # 2. Create primary queue with RedrivePolicy pointing to DLQ
    redrive_policy = json.dumps({"deadLetterTargetArn": dlq_arn, "maxReceiveCount": 5})
    main_res = sqs.create_queue(
        QueueName="supportpilot-webhooks",
        Attributes={
            "RedrivePolicy": redrive_policy,
            "VisibilityTimeout": "0",  # Immediate re-visibility for test iteration
        },
    )
    main_url = main_res["QueueUrl"]

    # 3. Publish message to primary SQS queue
    msg_payload = {
        "deliveryId": "del_thook_001",
        "tenantId": "tenant_enterprise",
        "url": target_url,
        "event": "ticket.created",
        "payload": {"ticketId": "tkt_500", "severity": "CRITICAL"},
        "attempt": 1,
    }
    sqs.send_message(QueueUrl=main_url, MessageBody=json.dumps(msg_payload))

    # 4. Simulate Lambda SQS event source mapping: 5 consecutive receive & fail cycles
    for attempt in range(1, 6):
        rx = sqs.receive_message(
            QueueUrl=main_url,
            AttributeNames=["ApproximateReceiveCount"],
            VisibilityTimeout=0,
        )
        msgs = rx.get("Messages", [])
        assert len(msgs) == 1, f"Expected message on attempt {attempt}"
        assert msgs[0]["Attributes"]["ApproximateReceiveCount"] == str(attempt)

        event = {
            "Records": [
                {
                    "messageId": msgs[0]["MessageId"],
                    "receiptHandle": msgs[0]["ReceiptHandle"],
                    "body": msgs[0]["Body"],
                    "attributes": msgs[0]["Attributes"],
                }
            ]
        }
        result = handler(event)

        # Handler must report item failure for partial batch retry
        failed_ids = {item["itemIdentifier"] for item in result.get("batchItemFailures", [])}
        assert msgs[0]["MessageId"] in failed_ids

        # In AWS SQS event source mapping with ReportBatchItemFailures:
        # Failed messages are NOT deleted, so visibility timeout expires and SQS retries.

    # 5. On the 6th receive attempt, SQS redrive policy has moved the message to DLQ
    post_rx = sqs.receive_message(QueueUrl=main_url, VisibilityTimeout=0)
    assert len(post_rx.get("Messages", [])) == 0, (
        "Primary queue must be empty after 5 failed receives"
    )

    # 6. Verify message is in DLQ with payload integrity preserved
    dlq_rx = sqs.receive_message(QueueUrl=dlq_url, AttributeNames=["All"])
    dlq_msgs = dlq_rx.get("Messages", [])
    assert len(dlq_msgs) == 1, "DLQ must contain exactly 1 redriven message"

    dlq_payload = json.loads(dlq_msgs[0]["Body"])
    assert dlq_payload["deliveryId"] == "del_thook_001"
    assert dlq_payload["tenantId"] == "tenant_enterprise"
    assert dlq_payload["payload"]["ticketId"] == "tkt_500"


@mock_aws
def test_t_hook_01_dlq_message_recovery(
    mock_webhook_server: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """T-HOOK-01 Recovery: Once the target endpoint is healthy, redrive from DLQ succeeds."""
    monkeypatch.setenv("WEBHOOK_ALLOW_LOCAL", "true")
    monkeypatch.setenv("WEBHOOK_SIGNING_SECRET", "whsec_test_signing_secret_12345")
    mock_webhook_server.next_status_code = 200

    port = mock_webhook_server.server_address[1]
    target_url = f"http://127.0.0.1:{port}/recovered-endpoint"

    sqs = boto3.client("sqs", region_name="us-east-1")

    # Setup DLQ with message
    dlq_res = sqs.create_queue(QueueName="supportpilot-webhooks-dlq")
    dlq_url = dlq_res["QueueUrl"]

    payload = {
        "deliveryId": "del_recovered",
        "tenantId": "tenant_enterprise",
        "url": target_url,
        "event": "ticket.resolved",
        "payload": {"ticketId": "tkt_500", "resolved": True},
    }
    sqs.send_message(QueueUrl=dlq_url, MessageBody=json.dumps(payload))

    # Read message from DLQ for recovery processing (mimicking StartMessageMoveTask or DLQ consumer)
    dlq_rx = sqs.receive_message(QueueUrl=dlq_url, AttributeNames=["All"])
    dlq_msgs = dlq_rx.get("Messages", [])
    assert len(dlq_msgs) == 1
    dlq_msg = dlq_msgs[0]

    event = {
        "Records": [
            {
                "messageId": dlq_msg["MessageId"],
                "receiptHandle": dlq_msg["ReceiptHandle"],
                "body": dlq_msg["Body"],
            }
        ]
    }
    result = handler(event)

    assert result == {"batchItemFailures": []}
    assert len(mock_webhook_server.received_requests) >= 1
    last_req = mock_webhook_server.received_requests[-1]
    assert last_req["headers"]["X-SupportPilot-Event"] == "ticket.resolved"
    assert last_req["headers"]["X-SupportPilot-Delivery"] == "del_recovered"

    # Successfully processed: delete from DLQ
    sqs.delete_message(QueueUrl=dlq_url, ReceiptHandle=dlq_msg["ReceiptHandle"])

    post_check = sqs.receive_message(QueueUrl=dlq_url)
    assert len(post_check.get("Messages", [])) == 0
