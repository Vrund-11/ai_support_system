import json
import subprocess
import urllib.request

lines = []
lines.append("=== ITEM 7: AI RUNTIME PROOF ===")
lines.append("(a) ACTIVE EMBEDDING PROVIDER AT RUNTIME (/v1/provider):")
try:
    with urllib.request.urlopen("http://127.0.0.1:4002/v1/provider") as res:
        lines.append(res.read().decode())
except Exception as e:
    lines.append(str(e))

lines.append("\n(b) MODEL NAME STORED IN CHUNK METADATA FOR 3 RANDOM CHUNKS:")
try:
    p = subprocess.run([
        r"C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "postgresql://postgres:admin123@127.0.0.1:5432/supportpilot",
        "-c", "SELECT id, chunk_index, metadata->'embedding_model' AS model, metadata FROM kb_chunks ORDER BY random() LIMIT 3;"
    ], capture_output=True, text=True)
    lines.append(p.stdout)
except Exception as e:
    lines.append(str(e))

lines.append("\n(c) PGVECTOR INDEX DEFINITION FROM \\d+ kb_chunks:")
try:
    p = subprocess.run([
        r"C:\Program Files\PostgreSQL\18\bin\psql.exe",
        "postgresql://postgres:admin123@127.0.0.1:5432/supportpilot",
        "-c", "\\d+ kb_chunks"
    ], capture_output=True, text=True)
    lines.append(p.stdout)
except Exception as e:
    lines.append(str(e))

lines.append("\n(d) REAL /v1/answer RESPONSE FOR GOLDEN SET QUESTION:")
try:
    req = urllib.request.Request(
        "http://127.0.0.1:4002/v1/answer",
        data=json.dumps({
            "tenant_id": "tenant_eval_01",
            "question": "How do I configure Single Sign-On using SAML 2.0 in SupportPilot?"
        }).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as res:
        lines.append(res.read().decode())
except Exception as e:
    lines.append(str(e))

content = "\n".join(lines)
with open("evidence/reaudit/07-ai-runtime.txt", "w", encoding="utf-8") as f:
    f.write(content)
print("Saved 07-ai-runtime.txt successfully")
