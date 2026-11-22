#!/usr/bin/env node
/**
 * scripts/coverage-table.mjs
 * Aggregates coverage from Vitest (Node/TypeScript) and pytest-cov (Python/FastAPI)
 * Produces defensible evidence/tests/coverage.md and checks >=70% gate.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const COVERAGE_SOURCES = [
  {
    name: 'packages/validators',
    framework: 'Vitest (v8)',
    summaryPath: path.join(ROOT, 'packages/validators/coverage/coverage-summary.json'),
    type: 'vitest',
  },
  {
    name: 'packages/shared-lib',
    framework: 'Vitest (v8)',
    summaryPath: path.join(ROOT, 'packages/shared-lib/coverage/coverage-summary.json'),
    type: 'vitest',
  },
  {
    name: 'apps/gateway',
    framework: 'Vitest (v8)',
    summaryPath: path.join(ROOT, 'apps/gateway/coverage/coverage-summary.json'),
    type: 'vitest',
  },
  {
    name: 'apps/ticket-service',
    framework: 'Vitest (v8)',
    summaryPath: path.join(ROOT, 'apps/ticket-service/coverage/coverage-summary.json'),
    type: 'vitest',
  },
  {
    name: 'apps/notification-service',
    framework: 'Vitest (v8)',
    summaryPath: path.join(ROOT, 'apps/notification-service/coverage/coverage-summary.json'),
    type: 'vitest',
  },
  {
    name: 'apps/ai-service',
    framework: 'pytest-cov',
    summaryPath: path.join(ROOT, 'apps/ai-service/coverage.json'),
    type: 'pytest',
  },
];

function parseVitest(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw);
  const total = json.total;
  return {
    lines: { total: total.lines.total, covered: total.lines.covered, pct: total.lines.pct },
    statements: { total: total.statements.total, covered: total.statements.covered, pct: total.statements.pct },
    branches: { total: total.branches.total, covered: total.branches.covered, pct: total.branches.pct },
    functions: { total: total.functions.total, covered: total.functions.covered, pct: total.functions.pct },
  };
}

function parsePytest(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const json = JSON.parse(raw);
  const totals = json.totals;
  const pct = Number(totals.percent_covered.toFixed(2));
  return {
    lines: { total: totals.num_statements, covered: totals.covered_lines, pct },
    statements: { total: totals.num_statements, covered: totals.covered_lines, pct },
    branches: { total: 0, covered: 0, pct: 100 },
    functions: { total: 0, covered: 0, pct: 100 },
  };
}

function run() {
  console.log('Aggregating coverage across SupportPilot monorepo...');
  const results = [];

  let grandTotalLines = 0;
  let grandCoveredLines = 0;
  let grandTotalStmts = 0;
  let grandCoveredStmts = 0;

  for (const src of COVERAGE_SOURCES) {
    let data = null;
    if (src.type === 'vitest') {
      data = parseVitest(src.summaryPath);
    } else if (src.type === 'pytest') {
      data = parsePytest(src.summaryPath);
    }

    if (!data) {
      console.warn(`Warning: Coverage file not found for ${src.name} at ${src.summaryPath}`);
      continue;
    }

    grandTotalLines += data.lines.total;
    grandCoveredLines += data.lines.covered;
    grandTotalStmts += data.statements.total;
    grandCoveredStmts += data.statements.covered;

    results.push({
      name: src.name,
      framework: src.framework,
      lines: data.lines,
      statements: data.statements,
      branches: data.branches,
      functions: data.functions,
      status: data.lines.pct >= 70 ? 'PASS' : 'WARN',
    });
  }

  const overallLinePct = grandTotalLines > 0
    ? Number(((grandCoveredLines / grandTotalLines) * 100).toFixed(2))
    : 0;

  const overallStmtPct = grandTotalStmts > 0
    ? Number(((grandCoveredStmts / grandTotalStmts) * 100).toFixed(2))
    : 0;

  const gatePassed = overallLinePct >= 70.0;

  // Format Markdown
  const timestamp = new Date().toISOString();
  let md = `# SupportPilot Code Coverage Report\n\n`;
  md += `*Generated: ${timestamp}*\n`;
  md += `*CI Threshold: >= 70.0% Line Coverage*\n`;
  md += `*Overall Gate Status: **${gatePassed ? 'PASSED' : 'FAILED'}** (${overallLinePct}% lines covered)*\n\n`;
  md += `## Coverage by Service & Package\n\n`;
  md += `| Package / Service | Framework | Total Lines | Covered Lines | Line % | Stmts % | Status |\n`;
  md += `|-------------------|-----------|:-----------:|:-------------:|:------:|:-------:|:------:|\n`;

  for (const r of results) {
    md += `| \`${r.name}\` | ${r.framework} | ${r.lines.total.toLocaleString()} | ${r.lines.covered.toLocaleString()} | ${r.lines.pct}% | ${r.statements.pct}% | ${r.status} |\n`;
  }

  md += `| **MONOREPO WEIGHTED TOTAL** | **Aggregate** | **${grandTotalLines.toLocaleString()}** | **${grandCoveredLines.toLocaleString()}** | **${overallLinePct}%** | **${overallStmtPct}%** | **${gatePassed ? 'PASS' : 'FAIL'}** |\n\n`;

  md += `## Detailed Metric Breakdown\n\n`;
  md += `| Package / Service | Branches (Cov/Tot) | Branch % | Functions (Cov/Tot) | Func % |\n`;
  md += `|-------------------|:-------------------:|:--------:|:-------------------:|:------:|\n`;
  for (const r of results) {
    md += `| \`${r.name}\` | ${r.branches.covered}/${r.branches.total} | ${r.branches.pct}% | ${r.functions.covered}/${r.functions.total} | ${r.functions.pct}% |\n`;
  }

  const evidencePath = path.join(ROOT, 'evidence/tests/coverage.md');
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  fs.writeFileSync(evidencePath, md, 'utf-8');

  console.log(`\nCoverage report written to: ${evidencePath}`);
  console.log(`Monorepo Line Coverage: ${overallLinePct}% (Gate: 70.0%) -> ${gatePassed ? 'PASSED' : 'FAILED'}`);

  if (!gatePassed) {
    console.error(`ERROR: Coverage threshold not met (${overallLinePct}% < 70.0%)`);
    process.exit(1);
  }
}

run();
