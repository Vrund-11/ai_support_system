"""Verify /v1/answer returns non-empty citations for 3 golden questions."""

import json
import urllib.request

GOLDEN_QUESTIONS = [
    {
        "id": "eval_auth_001",
        "question": "How do I configure Single Sign-On via SAML in SupportPilot?",
    },
    {
        "id": "eval_auth_004",
        "question": "Where do I find the ACS URL and Entity ID for Okta setup?",
    },
    {
        "id": "eval_auth_011",
        "question": "How many failed login attempts lock a user account?",
    },
]


def main():
    tenant_id = "tenant_eval_01"
    url = "http://localhost:8000/v1/answer"
    results = []

    for q in GOLDEN_QUESTIONS:
        payload = {
            "tenant_id": tenant_id,
            "question": q["question"],
        }
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            citations = data.get("citations", [])
            assert len(citations) > 0, f"Expected non-empty citations for {q['id']}, got: {citations}"
            results.append({
                "id": q["id"],
                "question": q["question"],
                "answer_preview": data.get("answer", "")[:100],
                "citation_count": len(citations),
                "citations": citations,
                "confidence": data.get("confidence"),
                "should_escalate": data.get("should_escalate"),
            })

    print(json.dumps({"golden_citations_verified": True, "samples": results}, indent=2))


if __name__ == "__main__":
    main()
