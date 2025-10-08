const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', '.vercel', '.turbo'
]);

const SECRET_PATTERNS = [
  { name: 'Google API key (AIza...)', regex: /AIza[0-9A-Za-z\-_]{20,80}/g },
  { name: 'Private key block', regex: /-----BEGIN [A-Z ]+PRIVATE KEY-----/g },
  { name: 'GitHub token', regex: /ghp_[0-9A-Za-z]{30,}/g },
  { name: 'Slack token', regex: /xox[baprs]-[0-9A-Za-z-]{10,}/g },
  { name: 'Stripe live key', regex: /sk_live_[0-9A-Za-z]{10,}/g }
];

function shouldIgnore(filePath) {
  const parts = filePath.split(path.sep);
  return parts.some((p) => IGNORED_DIRS.has(p));
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const findings = [];
  for (const pattern of SECRET_PATTERNS) {
    const matches = content.match(pattern.regex);
    if (matches) {
      findings.push({ pattern: pattern.name, samples: [...new Set(matches)].slice(0, 3) });
    }
  }
  return findings;
}

function walk(dir, results = []) {
  if (shouldIgnore(dir)) return results;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (shouldIgnore(fullPath)) continue;
    if (entry.isDirectory()) {
      walk(fullPath, results);
    } else if (entry.isFile()) {
      // Only scan text-like files
      const ext = path.extname(entry.name).toLowerCase();
      if (['.js', '.ts', '.tsx', '.json', '.md', '.sql', '.env', '.sh', '.py'].includes(ext) || ext === '') {
        try {
          const findings = scanFile(fullPath);
          if (findings.length > 0) {
            results.push({ file: fullPath, findings });
          }
        } catch {}
      }
    }
  }
  return results;
}

function main() {
  const root = process.cwd();
  const results = walk(root);
  if (results.length === 0) {
    console.log('✅ No obvious secrets detected.');
    process.exit(0);
  }
  console.error('❌ Potential secrets detected:');
  for (const r of results) {
    console.error(`\nFile: ${path.relative(root, r.file)}`);
    for (const f of r.findings) {
      console.error(`  - ${f.pattern}`);
      for (const s of f.samples) {
        console.error(`    sample: ${s.substring(0, 8)}...`);
      }
    }
  }
  process.exit(1);
}

main();
