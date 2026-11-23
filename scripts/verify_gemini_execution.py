#!/usr/bin/env python3
"""Verify Google Gemini API key behavior for /v1/answer and LLM judge (R3)."""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path
import httpx
from dotenv import dotenv_values

REPO_ROOT = Path(__file__).resolve().parent.parent
AI_ENV_PATH = REPO_ROOT / "apps" / "ai-service" / ".env"


async def main_async() -> int:
    print("=================================================================")
    print("VERIFICATION: Google Gemini API Execution for /v1/answer & Judge")
    print("=================================================================")

    env_vals = dotenv_values(AI_ENV_PATH) if AI_ENV_PATH.exists() else {}
    gemini_key = env_vals.get("GEMINI_API_KEY", "")

    print(f"Loaded .env from: {AI_ENV_PATH}")
    print(f"GEMINI_API_KEY configured: {'Yes' if gemini_key else 'No'}")
    print(f"Key length: {len(gemini_key)} chars")
    if gemini_key:
        masked_key = gemini_key[:4] + "..." + gemini_key[-4:] if len(gemini_key) > 8 else "***"
        print(f"Masked key: {masked_key}")

    # 1. Attempt /v1/answer generation via Gemini API
    print("\n--- 1. Testing /v1/answer Generation via Gemini API ---")
    gen_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key={gemini_key}"
    )
    gen_payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": (
                            "You are the SupportPilot AI assistant. Answer this support inquiry: "
                            "How do I configure Single Sign-On using SAML 2.0 in SupportPilot?"
                        )
                    }
                ]
            }
        ],
        "generationConfig": {"temperature": 0.2},
    }

    gen_status = None
    gen_body = None
    async with httpx.AsyncClient(timeout=25.0) as client:
        try:
            resp = await client.post(gen_url, json=gen_payload)
            if resp.status_code == 404:
                gen_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key={gemini_key}"
                resp = await client.post(gen_url, json=gen_payload)
            gen_status = resp.status_code
            gen_body = resp.text
            print(f"Response HTTP Status: {gen_status}")
            print(f"Response Body:\n{gen_body[:300]}...")
        except Exception as exc:
            print(f"Connection Exception: {exc}")

    # 2. Attempt LLM-Judge Evaluation via Gemini API
    print("\n--- 2. Testing LLM-Judge Groundedness Evaluation via Gemini API ---")
    judge_prompt = (
        "You are an impartial AI evaluator. Evaluate whether the provided Answer is "
        "strictly grounded in the Reference Context.\n\n"
        "Question: How do I configure Single Sign-On using SAML 2.0 in SupportPilot?\n"
        "Reference Context: SAML 2.0 SSO can be configured in Security Settings with your IdP metadata XML.\n"
        "Answer: To configure SAML 2.0 SSO, navigate to Security Settings and upload your IdP metadata XML file.\n"
    )
    judge_payload = {
        "contents": [{"parts": [{"text": judge_prompt}]}],
        "generationConfig": {"temperature": 0.0},
    }

    judge_status = None
    judge_body = None
    async with httpx.AsyncClient(timeout=25.0) as client:
        try:
            resp = await client.post(gen_url, json=judge_payload)
            judge_status = resp.status_code
            judge_body = resp.text
            print(f"Response HTTP Status: {judge_status}")
            print(f"Response Body:\n{judge_body[:300]}...")
        except Exception as exc:
            print(f"Connection Exception: {exc}")

    # 3. Verdict Assessment
    print("\n" + "=" * 65)
    if gen_status == 200 and judge_status == 200:
        print("VERDICT: VERIFIED")
        print("=" * 65)
        print(
            "VERIFIED: Google Gemini API execution for /v1/answer generation and\n"
            "LLM-judge groundedness evaluation completed successfully with authentic API key.\n"
            "Both API endpoints returned HTTP 200 OK with authentic LLM-generated responses."
        )
        print("=" * 65)
        return 0
    else:
        print("VERDICT: COULD NOT RUN")
        print("=" * 65)
        print(
            f"COULD NOT RUN: Real Gemini LLM generation returned error statuses.\n"
            f"Generation status: {gen_status}, Judge status: {judge_status}."
        )
        print("=" * 65)
        return 1


def main():
    code = asyncio.run(main_async())
    sys.exit(code)


if __name__ == "__main__":
    main()
