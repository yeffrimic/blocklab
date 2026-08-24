import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const engineDir = fileURLToPath(new URL('../../src/engine', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** El motor debe ser importable desde Node y testeable sin DOM: separación innegociable. */
describe('aislamiento del motor', () => {
  const files = walk(engineDir).filter((f) => f.endsWith('.ts'));

  it('encuentra los módulos del motor', () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it('ningún módulo de src/engine importa React ni la UI', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/from\s+'([^']+)'/g)) {
        const spec = m[1]!;
        const external = !spec.startsWith('.');
        const intoUi = spec.includes('/ui/') || spec.includes('/store/');
        if (external || intoUi) offenders.push(`${f}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no usa APIs del navegador', () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      if (/\b(document|window|localStorage|navigator)\b/.test(src)) offenders.push(f);
    }
    expect(offenders).toEqual([]);
  });
});
