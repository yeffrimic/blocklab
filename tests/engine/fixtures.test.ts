import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { EXAMPLES } from '../../src/engine/examples.ts';
import type { Diagram } from '../../src/engine/types.ts';
import { solve } from '../../src/engine/index.ts';
import * as P from '../../src/engine/polynomial/polynomial.ts';

const load = (name: string): Diagram =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8')) as Diagram;

describe('fixtures en JSON', () => {
  it('los diagramas de referencia son serializables sin pérdida', () => {
    for (const ex of EXAMPLES) {
      expect(load(ex.id), ex.id).toEqual(ex.diagram);
    }
  });

  it('resolver el JSON da el mismo resultado que resolver el objeto', () => {
    for (const ex of EXAMPLES) {
      const a = solve(ex.diagram).result!;
      const b = solve(load(ex.id)).result!;
      expect(P.toString(a.numerator)).toBe(P.toString(b.numerator));
      expect(P.toString(a.denominator)).toBe(P.toString(b.denominator));
    }
  });

  it('los fixtures inválidos siguen siendo inválidos tras el viaje por JSON', () => {
    for (const name of [
      'invalid-no-sink',
      'invalid-free-port',
      'invalid-undeclared',
      'invalid-unreachable',
      'invalid-self-loop',
    ]) {
      expect(solve(load(name)).issues.some((i) => i.level === 'error'), name).toBe(true);
    }
  });
});
