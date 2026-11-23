#!/usr/bin/env node
/**
 * scripts/count-tests.mjs
 * Dynamic Test Counting Automation for SupportPilot
 *
 * Dynamically parses actual test outputs from:
 * - Vitest JSON summaries (packages/validators, shared-lib, gateway, ticket-service, notification-service)
 * - Pytest JUnit XML (apps/ai-service)
 * - Playwright JSON/Text test reports (tests/e2e/playwright)
 * - Cypress JSON/Text test reports (tests/e2e/cypress)
 * - Newman JSON execution summary (API contract suite)
 * - k6 JSON benchmark summaries (load, spike, websocket)
 *
 * Integrity rules:
 * - NO static fallback numbers (e.g. no 77 pytest or 46/112 newman fakes).
 * - If a test output file is missing or invalid, reports 0 / COULD NOT RUN.
 * - Test counts separated strictly by runner.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const EVIDENCE_TESTS = path.join(ROOT, 'evidence/tests');
const EVIDENCE_PERF = path.join(ROOT, 'evidence/perf');
const EVIDENCE_REAUDIT3 = path.join(ROOT, 'evidence/reaudit3');
const REPORTS_DIR = path.join(ROOT, 'reports');

const VITEST_PACKAGES = [
  { name: 'packages/validators', reportFile: 'vitest-validators.json' },
  { name: 'packages/shared-lib', reportFile: 'vitest-shared-lib.json' },
  { name: 'packages/queue', reportFile: 'vitest-queue.json' },
  { name: 'apps/gateway', reportFile: 'vitest-gateway.json' },
  { name: 'apps/ticket-service', reportFile: 'vitest-ticket-service.json' },
  { name: 'apps/notification-service', reportFile: 'vitest-notification-service.json' },
  { name: 'apps/web', reportFile: 'vitest-web.json' },
  { name: 'apps/widget', reportFile: 'vitest-widget.json' },
];

/**
 * Parse Vitest JSON output
 */
function parseVitestJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    return {
      suites: data.numTotalTestSuites || (data.testResults ? data.testResults.length : 0),
      total: data.numTotalTests || 0,
      passed: data.numPassedTests || 0,
      failed: data.numFailedTests || 0,
      skipped: (data.numPendingTests || 0) + (data.numTodoTests || 0),
      status: (data.numFailedTests || 0) === 0 ? 'PASS' : 'FAIL',
    };
  } catch (err) {
    console.error(`Error parsing Vitest JSON ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Parse Pytest JUnit XML output
 */
function parsePytestXml(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const suiteMatch = raw.match(/<testsuite\s+[^>]*>/i);
    if (!suiteMatch) return null;
    const tag = suiteMatch[0];

    const getAttr = (name) => {
      const m = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
      return m ? parseInt(m[1], 10) : 0;
    };

    const tests = getAttr('tests');
    const failures = getAttr('failures');
    const errors = getAttr('errors');
    const skipped = getAttr('skipped');
    const passed = tests - failures - errors - skipped;

    const classnames = new Set();
    const classMatches = raw.matchAll(/classname="([^"]*)"/gi);
    for (const cm of classMatches) {
      classnames.add(cm[1]);
    }

    const testcaseCount = (raw.match(/<testcase/gi) || []).length;
    const totalTests = tests || testcaseCount;

    return {
      suites: classnames.size || (totalTests > 0 ? 1 : 0),
      total: totalTests,
      passed: passed >= 0 ? passed : 0,
      failed: failures + errors,
      skipped,
      status: (failures + errors) === 0 && totalTests > 0 ? 'PASS' : 'FAIL',
    };
  } catch (err) {
    console.error(`Error parsing Pytest XML ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Parse Newman execution JSON summary
 */
function parseNewmanJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw);
    const stats = data.run?.stats || {};
    const requests = stats.requests?.total || 0;
    const assertions = stats.assertions?.total || 0;
    const failed = (stats.assertions?.failed || 0) + (stats.requests?.failed || 0);

    return {
      requests,
      assertions,
      failed,
      status: failed === 0 && requests > 0 ? 'PASS' : 'FAIL',
    };
  } catch (err) {
    console.error(`Error parsing Newman JSON ${filePath}:`, err.message);
    return null;
  }
}

/**
 * Parse Playwright JSON or text log
 */
function parsePlaywright() {
  const jsonPaths = [
    path.join(REPORTS_DIR, 'playwright-results.json'),
    path.join(EVIDENCE_TESTS, 'playwright-results.json'),
    path.join(EVIDENCE_TESTS, 'playwright.json'),
  ];

  for (const jp of jsonPaths) {
    if (fs.existsSync(jp)) {
      try {
        const data = JSON.parse(fs.readFileSync(jp, 'utf-8'));
        const stats = data.stats || {};
        const passed = stats.expected || 0;
        const failed = stats.unexpected || 0;
        const skipped = stats.skipped || 0;
        const total = passed + failed + skipped;
        return {
          source: path.basename(jp),
          suites: data.suites?.length || 0,
          total,
          passed,
          failed,
          skipped,
          status: failed === 0 && total > 0 ? 'PASS' : 'FAIL',
        };
      } catch (err) {
        console.error(`Error parsing Playwright JSON ${jp}:`, err.message);
      }
    }
  }

  // Fallback to parsing text log if JSON report not emitted
  const txtPaths = [
    path.join(EVIDENCE_REAUDIT3, 'playwright-live.txt'),
    path.join(EVIDENCE_TESTS, 'playwright.txt'),
  ];
  for (const txtPath of txtPaths) {
    if (fs.existsSync(txtPath)) {
      try {
        const raw = fs.readFileSync(txtPath, 'utf-8');
        const passMatch = raw.match(/(\d+)\s+passed/i);
        const failMatch = raw.match(/(\d+)\s+failed/i);
        const runMatch = raw.match(/Running\s+(\d+)\s+tests/i);

        const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
        const total = runMatch ? parseInt(runMatch[1], 10) : passed + failed;

        const specFiles = new Set();
        const specMatches = raw.matchAll(/([a-zA-Z0-9_\-]+\.spec\.ts)/g);
        for (const sm of specMatches) {
          specFiles.add(sm[1]);
        }

        return {
          source: path.basename(txtPath),
          suites: specFiles.size,
          total,
          passed,
          failed,
          skipped: Math.max(0, total - passed - failed),
          status: failed === 0 && total > 0 ? 'PASS' : 'FAIL',
        };
      } catch (err) {
        console.error(`Error parsing Playwright text ${txtPath}:`, err.message);
      }
    }
  }

  return null;
}

/**
 * Parse Cypress JSON or text log
 */
function parseCypress() {
  const jsonPaths = [
    path.join(REPORTS_DIR, 'cypress-results.json'),
    path.join(EVIDENCE_TESTS, 'cypress-results.json'),
    path.join(EVIDENCE_TESTS, 'cypress.json'),
  ];

  for (const jp of jsonPaths) {
    if (fs.existsSync(jp)) {
      try {
        const data = JSON.parse(fs.readFileSync(jp, 'utf-8'));
        const total = data.totalTests || data.stats?.tests || 0;
        const passed = data.totalPassed || data.stats?.passes || 0;
        const failed = data.totalFailed || data.stats?.failures || 0;
        const skipped = data.totalPending || data.stats?.pending || 0;
        const suites = data.totalSuites || data.stats?.suites || 0;
        return {
          source: path.basename(jp),
          suites,
          total,
          passed,
          failed,
          skipped,
          status: failed === 0 && total > 0 ? 'PASS' : 'FAIL',
        };
      } catch (err) {
        console.error(`Error parsing Cypress JSON ${jp}:`, err.message);
      }
    }
  }

  // Fallback to parsing text report
  const txtPaths = [
    path.join(EVIDENCE_REAUDIT3, 'cypress-run.txt'),
    path.join(EVIDENCE_TESTS, 'cypress.txt'),
  ];
  for (const txtPath of txtPaths) {
    if (fs.existsSync(txtPath)) {
      try {
        const raw = fs.readFileSync(txtPath, 'utf-8');
        const specFiles = new Set();
        const specMatches = raw.matchAll(/([a-zA-Z0-9_\-]+\.cy\.ts)/g);
        for (const sm of specMatches) {
          specFiles.add(sm[1]);
        }

        const testsMatch = raw.match(/Tests:\s+(\d+)/i);
        const passMatch = raw.match(/Passing:\s+(\d+)/i);
        const failMatch = raw.match(/Failing:\s+(\d+)/i);
        const total = testsMatch ? parseInt(testsMatch[1], 10) : specFiles.size;
        const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
        const failed = failMatch ? parseInt(failMatch[1], 10) : 0;

        return {
          source: path.basename(txtPath),
          suites: specFiles.size,
          total,
          passed,
          failed,
          skipped: Math.max(0, total - passed - failed),
          status: failed === 0 && total > 0 ? 'PASS' : 'FAIL',
        };
      } catch (err) {
        console.error(`Error parsing Cypress text ${txtPath}:`, err.message);
      }
    }
  }

  return null;
}

/**
 * Parse k6 benchmark summary files
 */
function parseK6Summaries() {
  const summaries = [
    { name: 'Load Benchmark', file: 'k6-load.json' },
    { name: 'Spike Benchmark', file: 'k6-spike.json' },
    { name: 'WebSocket Benchmark', file: 'k6-ws.json' },
  ];

  const results = [];
  for (const item of summaries) {
    const searchDirs = [EVIDENCE_REAUDIT3, EVIDENCE_PERF];
    let fullPath = null;
    for (const d of searchDirs) {
      const p = path.join(d, item.file);
      if (fs.existsSync(p)) {
        fullPath = p;
        break;
      }
    }
    if (fullPath) {
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        const data = JSON.parse(raw);
        let checksPassed = 0;
        let checksFailed = 0;

        if (Array.isArray(data.root_group?.checks)) {
          for (const c of data.root_group.checks) {
            checksPassed += c.passes || 0;
            checksFailed += c.fails || 0;
          }
        }

        const reqCount = data.metrics?.http_reqs?.count || data.metrics?.ws_messages_sent?.count || 0;
        const p95 = data.metrics?.http_req_duration?.['p(95)'] || data.metrics?.ws_msg_latency?.['p(95)'] || null;
        const failedRate = data.metrics?.http_req_failed?.passes || checksFailed;

        results.push({
          scenario: item.name,
          file: item.file,
          checksPassed,
          checksFailed,
          requests: reqCount,
          p95Ms: p95 ? p95.toFixed(2) : 'N/A',
          status: failedRate === 0 ? 'PASS' : 'FAIL',
        });
      } catch (err) {
        console.error(`Error parsing k6 JSON ${fullPath}:`, err.message);
      }
    }
  }

  return results.length > 0 ? results : null;
}

function run() {
  console.log('Parsing dynamic test result files (strict honesty mode)...');

  // 1. Vitest Packages
  const unitRows = [];
  let tsSuites = 0;
  let tsTotal = 0;
  let tsPassed = 0;
  let tsFailed = 0;
  let tsSkipped = 0;

  for (const pkg of VITEST_PACKAGES) {
    const fullPath = path.join(EVIDENCE_TESTS, pkg.reportFile);
    const stats = parseVitestJson(fullPath);
    if (stats) {
      tsSuites += stats.suites;
      tsTotal += stats.total;
      tsPassed += stats.passed;
      tsFailed += stats.failed;
      tsSkipped += stats.skipped;

      unitRows.push({
        name: `\`${pkg.name}\``,
        framework: 'Vitest',
        suites: stats.suites,
        total: stats.total,
        passed: stats.passed,
        failed: stats.failed,
        skipped: stats.skipped,
        status: stats.status,
      });
    } else {
      unitRows.push({
        name: `\`${pkg.name}\``,
        framework: 'Vitest',
        suites: 0,
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        status: 'COULD NOT RUN',
      });
      console.warn(`Vitest report missing for ${pkg.name}: ${pkg.reportFile}`);
    }
  }

  // 2. Pytest (NO hardcoded fallback)
  const pytestPath = path.join(EVIDENCE_TESTS, 'pytest.xml');
  const pyStats = parsePytestXml(pytestPath);
  const pyRan = pyStats !== null;
  const pyResult = pyStats || {
    suites: 0,
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    status: 'COULD NOT RUN',
  };

  if (!pyRan) {
    console.warn(`Pytest report missing at ${pytestPath}`);
  }

  const grandSuites = tsSuites + pyResult.suites;
  const grandTotal = tsTotal + pyResult.total;
  const grandPassed = tsPassed + pyResult.passed;
  const grandFailed = tsFailed + pyResult.failed;
  const grandSkipped = tsSkipped + pyResult.skipped;
  const grandStatus = (tsFailed + pyResult.failed === 0 && grandTotal > 0) ? 'PASS' : (grandTotal === 0 ? 'COULD NOT RUN' : 'FAIL');

  // 3. Playwright (NO hardcoded fallback)
  const pwStats = parsePlaywright();
  if (!pwStats) {
    console.warn('Playwright report missing');
  }

  // 4. Cypress (NO hardcoded fallback)
  const cyStats = parseCypress();
  if (!cyStats) {
    console.warn('Cypress report missing');
  }

  // 5. Newman (NO hardcoded fallback)
  const newmanPath = path.join(EVIDENCE_TESTS, 'newman-summary.json');
  const newmanStats = parseNewmanJson(newmanPath);
  if (!newmanStats) {
    console.warn(`Newman report missing at ${newmanPath}`);
  }

  // 6. k6 (NO hardcoded fallback)
  const k6Stats = parseK6Summaries();
  if (!k6Stats) {
    console.warn('k6 summaries missing in evidence/perf');
  }

  // Build markdown report
  const now = new Date().toISOString();
  let md = `# SupportPilot Test Counts\n\n`;
  md += `*Generated: ${now}*\n`;
  md += `*Integrity Mode: Strict — All counts dynamically parsed from output files, zero static fakes*\n\n`;

  // Section 1: TypeScript Unit & Integration (Vitest)
  md += `## 1. Unit & Integration Test Suites (Vitest / TypeScript)\n\n`;
  md += `| Package / Directory | Framework | Test Suites | Total Tests | Passed | Failed | Skipped | Status |\n`;
  md += `|---------------------|-----------|:-----------:|:-----------:|:------:|:------:|:-------:|:------:|\n`;
  for (const r of unitRows) {
    md += `| ${r.name} | ${r.framework} | ${r.suites} | ${r.total} | ${r.passed} | ${r.failed} | ${r.skipped} | ${r.status} |\n`;
  }
  md += `| **Subtotal (TypeScript / Vitest)** | **Vitest** | **${tsSuites}** | **${tsTotal}** | **${tsPassed}** | **${tsFailed}** | **${tsSkipped}** | **${tsFailed === 0 && tsTotal > 0 ? 'PASS' : (tsTotal === 0 ? 'COULD NOT RUN' : 'FAIL')}** |\n\n`;

  // Section 2: Python Unit & Integration (Pytest)
  md += `## 2. Unit & Integration Test Suites (Pytest / Python)\n\n`;
  md += `| Package / Directory | Framework | Test Suites | Total Tests | Passed | Failed | Skipped | Status |\n`;
  md += `|---------------------|-----------|:-----------:|:-----------:|:------:|:------:|:-------:|:------:|\n`;
  md += `| \`apps/ai-service\` | Pytest | ${pyResult.suites} | ${pyResult.total} | ${pyResult.passed} | ${pyResult.failed} | ${pyResult.skipped} | ${pyResult.status} |\n`;
  md += `| **Subtotal (Python / Pytest)** | **Pytest** | **${pyResult.suites}** | **${pyResult.total}** | **${pyResult.passed}** | **${pyResult.failed}** | **${pyResult.skipped}** | **${pyResult.status}** |\n\n`;

  // Section 3: Total Unit & Integration Summary
  md += `## 3. Total Unit & Integration Tests\n\n`;
  md += `| Frameworks | Test Suites | Total Tests | Passed | Failed | Skipped | Overall Status |\n`;
  md += `|------------|:-----------:|:-----------:|:------:|:------:|:-------:|:--------------:|\n`;
  md += `| Vitest + Pytest | **${grandSuites}** | **${grandTotal}** | **${grandPassed}** | **${grandFailed}** | **${grandSkipped}** | **${grandStatus}** |\n\n`;

  // Section 4: End-to-End, Contract & Benchmark Suites
  md += `## 4. End-to-End, Contract & Benchmark Suites (Strict Runner Separation)\n\n`;
  md += `| Runner | Tool / Framework | Target Scope | Discrete Items | Outcome / Assertions | Status |\n`;
  md += `|--------|------------------|--------------|:--------------:|:--------------------:|:------:|\n`;

  // Playwright
  if (pwStats) {
    md += `| Browser E2E | Playwright | Widget, Dashboard, Realtime | ${pwStats.suites} spec files | ${pwStats.passed} passed (${pwStats.total} total) | ${pwStats.status} |\n`;
  } else {
    md += `| Browser E2E | Playwright | Widget, Dashboard, Realtime | 0 spec files | 0 tests | COULD NOT RUN |\n`;
  }

  // Cypress
  if (cyStats) {
    md += `| Role & Security E2E | Cypress | Admin Cockpit & RBAC Matrix | ${cyStats.suites} spec files | ${cyStats.total} scenarios verified | ${cyStats.status} |\n`;
  } else {
    md += `| Role & Security E2E | Cypress | Admin Cockpit & RBAC Matrix | 0 spec files | 0 scenarios | COULD NOT RUN |\n`;
  }

  // Newman
  if (newmanStats) {
    md += `| API Contract | Newman (Postman) | Gateway REST Endpoints | ${newmanStats.requests} requests | ${newmanStats.assertions} assertions (${newmanStats.failed} failed) | ${newmanStats.status} |\n`;
  } else {
    md += `| API Contract | Newman (Postman) | Gateway REST Endpoints | 0 requests | 0 assertions | COULD NOT RUN |\n`;
  }

  // k6
  if (k6Stats) {
    for (const k of k6Stats) {
      md += `| Benchmark | k6 (${k.scenario}) | Performance & Latency | ${k.requests} requests | ${k.checksPassed} checks passed, p95: ${k.p95Ms}ms | ${k.status} |\n`;
    }
  } else {
    md += `| Benchmark | k6 | Performance & Latency | 0 scenarios | 0 requests | COULD NOT RUN |\n`;
  }

  const outputPath = path.join(EVIDENCE_TESTS, 'test-counts.md');
  fs.writeFileSync(outputPath, md, 'utf-8');

  const pwMocked = pwStats?.total || 0;
  const cyTotal = cyStats?.total || 0;
  const newmanTotal = newmanStats?.assertions || 0;
  const grandGrandTotal = tsTotal + pyResult.total + pwMocked + cyTotal + newmanTotal;

  console.log(`Test counts successfully written to ${outputPath}`);
  console.log(`\nVitest (packages & services): ${tsTotal}`);
  console.log(`Pytest (ai-service): ${pyResult.total}`);
  console.log(`Playwright (mocked): ${pwMocked}`);
  console.log(`Playwright (live): 0`);
  console.log(`Cypress: ${cyTotal}`);
  console.log(`Newman: ${newmanTotal}`);
  console.log(`Total: ${grandGrandTotal}`);
}

run();
