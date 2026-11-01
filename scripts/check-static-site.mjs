import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.xml', '.txt', '.svg', '.webmanifest']);
function filesIn(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) {
  if (/^@(supabase|lovable\.dev)\//i.test(name) || name === 'lovable-tagger') {
    failures.push(`Remove provider dependency: ${name}`);
  }
}
for (const path of ['supabase', '.lovable', 'src/integrations/supabase', 'src/integrations/lovable', 'src/lib/mcp']) {
  if (filesIn(join(root, path)).length) failures.push(`Remove obsolete integration files: ${path}`);
}
if (existsSync(join(root, '.env'))) failures.push('A static site must not require a tracked .env file.');

const files = [...filesIn(join(root, 'src')), ...filesIn(join(root, 'public')), join(root, 'index.html'), join(root, 'vite.config.ts')];
for (const path of files) {
  if (!sourceExtensions.has(extname(path)) || !existsSync(path)) continue;
  const text = readFileSync(path, 'utf8');
  if (/@supabase\/|@lovable\.dev\/|lovable-tagger|https?:\/\/[^\s"'`<>]*(?:supabase\.(?:co|com)|lovable\.(?:app|dev)|lovableproject(?:-dev)?\.com)/i.test(text)) {
    failures.push(`Provider reference remains: ${path.slice(root.length + 1)}`);
  }
  if (/['"]\/(?:admin|auth)(?:[/'"])/i.test(text)) failures.push(`Private route remains: ${path.slice(root.length + 1)}`);
  if (!/\.[jt]sx?$/.test(path)) continue;
  for (const match of text.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
    const specifier = match[1].split('?')[0];
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
    const base = specifier.startsWith('@/') ? resolve(root, 'src', specifier.slice(2)) : resolve(dirname(path), specifier);
    const candidates = [base, ...['.ts', '.tsx', '.js', '.jsx', '.json', '/index.ts', '/index.tsx', '/index.js'].map(extension => base + extension)];
    if (!candidates.some(candidate => existsSync(candidate) && statSync(candidate).isFile())) {
      failures.push(`Unresolved local import in ${path.slice(root.length + 1)}: ${specifier}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Static site checks passed: no provider SDKs, private routes, or unresolved local imports.');
}
