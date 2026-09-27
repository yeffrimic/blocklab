import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import type { Diagram } from '../../src/engine/types.ts';
import { buildSfg } from '../../src/engine/sfg/build.ts';
import { isSingular, mason } from '../../src/engine/mason.ts';
import { naming, reduce } from '../../src/engine/reduce.ts';
import { ratioToString } from '../../src/engine/polynomial/ratio.ts';
import * as P from '../../src/engine/polynomial/polynomial.ts';
import { T1, T2, T3, T4, T5, T6, T7 } from '../../src/engine/examples.ts';

// Con los nombres, igual que hace `solve`: sin ellos los pasos hablan de ids
// internos y las pruebas de redacción no estarían mirando lo que ve el estudiante.
const run = (d: Diagram) => {
  const sfg = buildSfg(d);
  const m = mason(sfg);
  return { r: reduce(sfg, m, naming(d)), m };
};

const CASES: [string, Diagram][] = [
  ['T1', T1], ['T2', T2], ['T3', T3], ['T4', T4], ['T5', T5], ['T6', T6], ['T7', T7],
];

describe('reducción narrada', () => {
  it.each(CASES)('%s termina y coincide con Mason', (_name, d) => {
    const { r } = run(d);
    expect(r.result).not.toBeNull();
    expect(r.matchesMason).toBe(true);
  });

  it.each(CASES)('%s deja el grafo en una sola arista', (_name, d) => {
    const { r } = run(d);
    const last = r.steps.length ? r.steps[r.steps.length - 1]!.graph : r.start;
    expect(last.nodes.sort()).toEqual([last.sink, last.source].sort());
  });

  it('narra la cascada de T1 como cascada', () => {
    const { r } = run(T1);
    // R -> C directo: el SFG ya viene colapsado, no queda nodo interior.
    expect(r.steps.every((s) => s.kind !== 'eliminate')).toBe(true);
  });

  it('T3 se cuenta como un lazo cerrado', () => {
    const { r } = run(T3);
    expect(r.steps.some((s) => s.kind === 'selfloop')).toBe(true);
    expect(ratioToString(r.result!)).toBe('(G1) / (1 + G1)');
  });

  it('T2 se cuenta como ramas en paralelo', () => {
    const { r } = run(T2);
    expect(r.steps.some((s) => s.kind === 'parallel')).toBe(true);
  });

  it('cada paso apunta a elementos que existen en el diagrama', () => {
    const ids = new Set([...T7.nodes.map((n) => n.id), ...T7.edges.map((e) => e.id)]);
    const { r } = run(T7);
    for (const s of r.steps) {
      for (const e of s.via.edges) expect(ids.has(e), `arista ${e}`).toBe(true);
      for (const b of s.via.blocks) expect(ids.has(b), `bloque ${b}`).toBe(true);
    }
  });

  it('coincide con Mason en todos los fixtures válidos', () => {
    for (const f of readdirSync('tests/fixtures').filter((n) => /^T\d\.json$/.test(n))) {
      const d = JSON.parse(readFileSync(`tests/fixtures/${f}`, 'utf8')) as Diagram;
      const { r } = run(d);
      expect(r.matchesMason, f).toBe(true);
    }
  });
});

describe('la reducción se presenta simplificada', () => {
  // Cross-multiplicar no basta: un resultado equivalente pero sin cancelar es
  // correcto y aun así ilegible. Se exige la misma forma que da Mason.
  it.each(CASES)('%s llega a la forma canónica de Mason', (_name, d) => {
    const { r, m } = run(d);
    expect(ratioToString(r.result!)).toBe(
      m.denominator.size === 1 && [...m.denominator.values()][0]!.vars.size === 0
        ? ratioToString({ num: m.numerator, den: m.denominator })
        : `(${P.toStringFactored(m.numerator)}) / (${P.toStringFactored(m.denominator)})`,
    );
  });

  it('T7, con lazos entrelazados, tampoco se hincha', () => {
    const { r } = run(T7);
    expect(ratioToString(r.result!)).toBe(
      '(G6*(G4 + G5*(G2 + G3))) / (1 + G1*(G2 + G3) + G6*(1 + G1*(G2 + G3) + G7*(G4 + G5*(G2 + G3))))',
    );
  });
});

describe('lo que ve el estudiante', () => {
  const ALL: [string, Diagram][] = [...CASES];

  it('cada grafo tiene ids de arista únicos', () => {
    // Se repetían: las aristas de partida y las generadas compartían prefijo, y
    // en el SVG del panel eso son dos claves de React iguales.
    for (const [name, d] of ALL) {
      const { r } = run(d);
      for (const [k, g] of [r.start, ...r.steps.map((s) => s.graph)].entries()) {
        const ids = g.edges.map((e) => e.id);
        expect(new Set(ids).size, `${name}, paso ${k}`).toBe(ids.length);
      }
    }
  });

  it('los pasos hablan de sumadores y bifurcaciones, no de ids internos', () => {
    for (const [name, d] of ALL) {
      const sfg = buildSfg(d);
      const { r } = run(d);
      for (const s of r.steps) {
        for (const id of sfg.nodes) {
          expect(s.detail.includes(` ${id} `), `${name}: "${id}" suelto en el texto`).toBe(false);
        }
      }
    }
  });

  it('no deja contracciones mal escritas', () => {
    // Con límite de palabra: «se cierra el lazo» contiene «a el» y es correcto.
    const bad = /(a|de) el/i;
    for (const [name, d] of ALL) {
      const { r } = run(d);
      for (const s of r.steps) {
        expect(bad.test(s.detail), `${name}: "${s.detail}"`).toBe(false);
      }
    }
  });

  it('todo paso que cierra un lazo enseña la ganancia de ese lazo', () => {
    for (const [name, d] of ALL) {
      const { r } = run(d);
      for (const s of r.steps) {
        if (s.kind === 'selfloop') expect(s.loopGain, `${name}: ${s.title}`).not.toBeNull();
        else expect(s.loopGain, `${name}: ${s.title}`).toBeNull();
      }
    }
  });
});

describe('sistema singular', () => {
  // Realimentación positiva unitaria: la ganancia de lazo vale 1 y Δ se anula.
  const singular: Diagram = {
    version: 1,
    nodes: [
      { id: 'R', kind: 'source', label: 'R', pos: { x: 0, y: 0 } },
      { id: 's', kind: 'sum', ports: [{ id: 'p1', sign: 1 }, { id: 'p2', sign: 1 }], pos: { x: 100, y: 0 } },
      { id: 'b', kind: 'block', gain: '1', pos: { x: 200, y: 0 } },
      { id: 'pk', kind: 'pickoff', pos: { x: 300, y: 0 } },
      { id: 'C', kind: 'sink', label: 'C', pos: { x: 400, y: 0 } },
    ],
    edges: [
      { id: 'e1', from: 'R', to: 's', toPort: 'p1' },
      { id: 'e2', from: 's', to: 'b' },
      { id: 'e3', from: 'b', to: 'pk' },
      { id: 'e4', from: 'pk', to: 'C' },
      { id: 'e5', from: 'pk', to: 's', toPort: 'p2' },
    ],
    symbols: [],
  };

  it('se detecta en vez de mostrar una división entre cero', () => {
    const sfg = buildSfg(singular);
    const m = mason(sfg);
    expect(isSingular(m)).toBe(true);
    expect(m.warnings.join(' ')).toContain('Δ = 0');
  });

  it('los casos normales no se marcan como singulares', () => {
    for (const [name, d] of CASES) {
      const sfg = buildSfg(d);
      expect(isSingular(mason(sfg)), name).toBe(false);
    }
  });
});

describe('el aviso del fallo típico', () => {
  it('se dice una sola vez, no en cada lazo', () => {
    // Repetido en cada paso deja de leerse y estorba.
    for (const [name, d] of CASES) {
      const { r } = run(d);
      const veces = r.steps.filter((s) => s.detail.includes('Ese es el fallo típico')).length;
      expect(veces, name).toBeLessThanOrEqual(1);
    }
  });

  it('se dice al menos una vez cuando hay un lazo con varios bloques', () => {
    const { r } = run(T5);
    expect(r.steps.some((s) => s.detail.includes('Ese es el fallo típico'))).toBe(true);
  });
});
