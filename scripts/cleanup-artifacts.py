#!/usr/bin/env python3
"""Cleanup sensitive data from evidence artifacts."""

import json
import re
from pathlib import Path

# 1. Redact curl logs in evidence/reaudit3 and elsewhere
token_pattern = re.compile(r'(x-service-token:\s*)[^\s\'\"\`]+', re.IGNORECASE)
for p in Path('evidence').rglob('*.txt'):
    try:
        txt = p.read_text(encoding='utf-8')
        if 'x-service-token:' in txt.lower():
            redacted = token_pattern.sub(r'\1[REDACTED_TOKEN]', txt)
            p.write_text(redacted, encoding='utf-8')
            print(f'Redacted token in {p}')
    except Exception as e:
        print(f'Skipping {p}: {e}')

# 2. Strip setup_data from all k6 json files
perf_dir = Path('evidence/perf')
perf_dir.mkdir(parents=True, exist_ok=True)

for fname in ['k6-load.json', 'k6-spike.json', 'k6-ws.json']:
    src = Path('evidence/reaudit3') / fname
    if src.exists():
        data = json.loads(src.read_text(encoding='utf-8'))
        if 'setup_data' in data:
            del data['setup_data']
            print(f'Stripped setup_data from {src}')
        cleaned = json.dumps(data, indent=2)
        src.write_text(cleaned, encoding='utf-8')

        # Also write clean files to evidence/perf
        dst = perf_dir / fname
        dst.write_text(cleaned, encoding='utf-8')
        print(f'Saved clean copy to {dst}')

        summary_name = fname.replace('.json', '-summary.json')
        dst_summary = perf_dir / summary_name
        dst_summary.write_text(cleaned, encoding='utf-8')
        print(f'Saved clean copy to {dst_summary}')

print('Artifact cleanup complete.')
