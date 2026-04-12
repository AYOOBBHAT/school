import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.join(__dirname, '..', 'src');

function walk(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(ent.name)) acc.push(p);
  }
}

const files = [];
walk(srcRoot, files);

for (const f of files) {
  if (f.replace(/\\/g, '/').endsWith('utils/devLog.ts')) continue;
  let s = fs.readFileSync(f, 'utf8');
  if (!/console\.(log|error|warn|debug)\(/.test(s)) continue;

  const relDir = path.relative(path.dirname(f), path.join(srcRoot, 'utils'));
  let importPath = path.join(relDir, 'devLog').replace(/\\/g, '/');
  if (!importPath.startsWith('.')) importPath = './' + importPath;

  const importLine = `import { devError, devLog, devWarn } from '${importPath}';\n`;
  const hasImport =
    s.includes(`from '${importPath}'`) || s.includes(`from "${importPath}"`);

  s = s.replace(/console\.error\(/g, 'devError(');
  s = s.replace(/console\.log\(/g, 'devLog(');
  s = s.replace(/console\.warn\(/g, 'devWarn(');
  s = s.replace(/console\.debug\(/g, 'devLog(');

  if (!hasImport) {
    s = importLine + s;
  }

  fs.writeFileSync(f, s);
}

console.log('Wrapped console.* in', files.filter((f) => !f.includes('devLog.ts')).length, 'files (check manually)');
