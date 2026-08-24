import { describe, expect, it } from 'vitest';
import {
  T1,
  T2,
  T3,
  T4,
  T5,
  T6,
  T7,
} from '../../src/engine/examples.ts';
import { buildSfg } from '../../src/engine/sfg/build.ts';
import { elementaryLoops } from '../../src/engine/sfg/loops.ts';
import { forwardPaths } from '../../src/engine/sfg/paths.ts';
import { nonTouchingSets } from '../../src/engine/sfg/nontouching.ts';
import { resultToLatex, resultToString } from '../../src/engine/mason.ts';
import type { Diagram } from '../../src/engine/types.ts';
import * as P from '../../src/engine/polynomial/polynomial.ts';
import { expectTransfer, gains, solveOk } from './helpers.ts';

describe('T1 — serie', () => {
  it('multiplica las ganancias en cascada', () => {
    expectTransfer(T1, 'G1*G2', '1');
  });

  it('colapsa la cascada de bloques en una sola arista del SFG', () => {
    const sfg = buildSfg(T1);
    expect(sfg.nodes).toEqual(['R', 'C']);
    expect(sfg.edges).toHaveLength(1);
    expect(sfg.edges[0]!.gain).toEqual(['G1', 'G2']);
  });
});

describe('T2 — paralelo', () => {
  it('suma las dos ramas', () => {
    expectTransfer(T2, 'G1 + G2', '1');
  });

  it('cuenta dos caminos directos distintos entre el mismo par de nodos', () => {
    const r = solveOk(T2);
    expect(gains(r.paths)).toEqual(['G1', 'G2']);
    expect(r.loops).toHaveLength(0);
  });
});

describe('T3 — realimentación negativa unitaria', () => {
  it('da G1 / (1 + G1)', () => {
    expectTransfer(T3, 'G1', '1 + G1');
  });

  it('el lazo lleva el signo del puerto, así que L = -G1', () => {
    const r = solveOk(T3);
    expect(gains(r.loops)).toEqual(['-G1']);
  });
});

describe('T4 — realimentación positiva', () => {
  it('da G1 / (1 - G1): no todos los lazos son negativos', () => {
    expectTransfer(T4, 'G1', '1 - G1');
  });

  it('el lazo es positivo', () => {
    const r = solveOk(T4);
    expect(gains(r.loops)).toEqual(['G1']);
  });
});

describe('T5 — lazos anidados', () => {
  it('no aporta término de producto porque los lazos se tocan', () => {
    expectTransfer(T5, 'G1*G2', '1 + G1*H1 + G1*G2*H2');
  });

  it('los dos lazos comparten nodos', () => {
    const r = solveOk(T5);
    expect(gains(r.loops)).toEqual(['-G1*G2*H2', '-G1*H1']);
    expect(nonTouchingSets(r.loops)).toEqual([]);
  });
});

describe('T6 — lazos no adyacentes', () => {
  it('el denominador incluye el producto de los dos lazos', () => {
    expectTransfer(T6, 'G1*G2', '1 + G1*H1 + G2*H2 + G1*G2*H1*H2');
  });

  it('detecta exactamente un par no adyacente', () => {
    const r = solveOk(T6);
    expect(r.loops).toHaveLength(2);
    expect(nonTouchingSets(r.loops)).toHaveLength(1);
  });
});

describe('T7 — caso de referencia (examen)', () => {
  const NUM = 'G2*G5*G6 + G3*G5*G6 + G4*G6';
  const DEN =
    '1 + G1*G2 + G1*G3 + G6 + G1*G2*G6 + G1*G3*G6 + G2*G5*G6*G7 + G3*G5*G6*G7 + G4*G6*G7';

  it('reproduce la función de transferencia esperada', () => {
    expectTransfer(T7, NUM, DEN);
  });

  it('encuentra los tres caminos directos, todos con Δk = 1', () => {
    const r = solveOk(T7);
    expect(gains(r.paths)).toEqual(['G2*G5*G6', 'G3*G5*G6', 'G4*G6']);
    for (const dk of r.pathDeltas) expect(P.toString(dk.value)).toBe('1');
  });

  it('encuentra los seis lazos con sus signos', () => {
    const r = solveOk(T7);
    expect(gains(r.loops)).toEqual([
      '-G1*G2',
      '-G1*G3',
      '-G2*G5*G6*G7',
      '-G3*G5*G6*G7',
      '-G4*G6*G7',
      '-G6',
    ]);
  });

  it('el único par no adyacente es el lazo de G1 con el de G6', () => {
    const r = solveOk(T7);
    const sets = nonTouchingSets(r.loops);
    const products = sets
      .map((s) => P.toString(s.loops.map((i) => r.loops[i]!.gain).reduce(P.mul, P.one())))
      .sort();
    expect(products).toEqual(['G1*G2*G6', 'G1*G3*G6']);
  });

  it('factoriza como (1+G6)(1+G1(G2+G3)) + G6*G7*[(G2+G3)G5+G4]', () => {
    const r = solveOk(T7);
    const [G1, G2, G3, G4, G5, G6, G7] = (
      ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'] as const
    ).map(P.symbol);
    const g2g3 = P.add(G2!, G3!);
    const bracket = P.add(P.mul(g2g3, G5!), G4!);
    const expected = P.add(
      P.mul(P.add(P.one(), G6!), P.add(P.one(), P.mul(G1!, g2g3))),
      P.mul(P.mul(G6!, G7!), bracket),
    );
    expect(P.equals(r.denominator, expected)).toBe(true);
    expect(P.equals(r.numerator, P.mul(G6!, bracket))).toBe(true);
  });
});

describe('recuento de caminos y lazos', () => {
  it('no repite ciclos rotados', () => {
    const sfg = buildSfg(T7);
    expect(elementaryLoops(sfg)).toHaveLength(6);
    expect(forwardPaths(sfg)).toHaveLength(3);
  });
});

describe('presentación del resultado', () => {
  it('omite el denominador cuando Δ = 1', () => {
    expect(resultToString(solveOk(T1))).toBe('G1*G2');
    expect(resultToLatex(solveOk(T2))).toBe('G_{1} + G_{2}');
  });

  it('mantiene la fracción cuando hay lazos', () => {
    expect(resultToString(solveOk(T3))).toBe('(G1) / (1 + G1)');
    expect(resultToString(solveOk(T5))).toBe('(G1*G2) / (1 + G1*(H1 + G2*H2))');
  });

  it('escribe la fracción de LaTeX con la barra escapada', () => {
    expect(resultToLatex(solveOk(T3))).toBe('\\frac{G_{1}}{1 + G_{1}}');
  });
});

describe('el lado del conector es solo presentación', () => {
  it('no cambia el SFG ni la función de transferencia', () => {
    const plain = solveOk(T5);
    // Mismo diagrama con todas las aristas marcadas al revés de como se dibujarían.
    const flipped: Diagram = {
      ...T5,
      edges: T5.edges.map((e) => ({ ...e, fromSide: 'left' as const, toSide: 'right' as const })),
    };
    const withSides = solveOk(flipped);
    expect(P.toString(withSides.numerator)).toBe(P.toString(plain.numerator));
    expect(P.toString(withSides.denominator)).toBe(P.toString(plain.denominator));
    expect(gains(withSides.loops)).toEqual(gains(plain.loops));
  });

  it('espejar el sumador no toca los signos', () => {
    const plain = solveOk(T5);
    const mirrored: Diagram = {
      ...T5,
      nodes: T5.nodes.map((n) => (n.kind === 'sum' ? { ...n, facing: 'left' as const } : n)),
    };
    const flipped = solveOk(mirrored);
    expect(P.toString(flipped.denominator)).toBe(P.toString(plain.denominator));
    expect(gains(flipped.loops)).toEqual(gains(plain.loops));
  });
});
