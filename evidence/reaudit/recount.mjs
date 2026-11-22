import fs from 'node:fs';
import path from 'node:path';

function walk(dir) {
  let files = [];
  if (!fs.existsSync(dir)) return files;
  fs.readdirSync(dir, { withFileTypes: true }).forEach(d => {
    const full = path.join(dir, d.name);
    if (d.isDirectory()) {
      if (!['node_modules', 'dist', '.venv', '.turbo', '__pycache__'].includes(d.name)) {
        files = files.concat(walk(full));
      }
    } else {
      files.push(full);
    }
  });
  return files;
}

// 1. Gateway
const gwFiles = walk('apps/gateway/src').filter(f => f.endsWith('.ts'));
let gwCount = 0;
gwFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/\.(get|post|put|patch|delete)\s*\(\s*['"][^'"]+['"]/g) || [];
  gwCount += matches.length;
});

// 2. Notification service
const notifFiles = walk('apps/notification-service/src').filter(f => f.endsWith('.ts'));
let notifCount = 0;
notifFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/\.(get|post|put|patch|delete)\s*\(\s*['"][^'"]+['"]/g) || [];
  notifCount += matches.length;
});

// 3. Ticket service
const ticketFiles = walk('apps/ticket-service/src').filter(f => f.endsWith('.ts'));
let ticketCount = 0;
ticketFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/\.(get|post|put|patch|delete)\s*\(\s*['"][^'"]+['"]/g) || [];
  ticketCount += matches.length;
});

// 4. AI service (FastAPI)
const aiFiles = walk('apps/ai-service/src').filter(f => f.endsWith('.py'));
let aiCount = 0;
aiFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.match(/@(app|router)\.(get|post|put|patch|delete)\s*\(\s*['"][^'"]+['"]/g) || [];
  aiCount += matches.length;
});

console.log('Independent grep count:');
console.log('Gateway Express calls:', gwCount);
console.log('Notification Express calls:', notifCount);
console.log('Ticket-service Express calls:', ticketCount);
console.log('AI-service FastAPI decorators:', aiCount);
console.log('Total Raw Route Invocations:', gwCount + notifCount + ticketCount + aiCount);
