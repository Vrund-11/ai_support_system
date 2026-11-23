import subprocess
import sys

benchmarks = [
    ("k6-load.txt", r'"C:\Program Files\k6\k6.exe" run tests/perf/tickets.js --summary-export evidence/reaudit3/k6-load.json'),
    ("k6-spike.txt", r'"C:\Program Files\k6\k6.exe" run tests/perf/ticket-spike.js --summary-export evidence/reaudit3/k6-spike.json'),
    ("k6-ws.txt", r'"C:\Program Files\k6\k6.exe" run tests/perf/chat.js --summary-export evidence/reaudit3/k6-ws.json'),
]

for name, cmd in benchmarks:
    print(f"=== Starting benchmark: {name} ===")
    res = subprocess.run([
        sys.executable,
        "scripts/capture-evidence.py",
        "--name", name,
        "--command", cmd
    ])
    print(f"=== Finished {name}: Exit {res.returncode} ===")
