import { expect } from 'vitest';
import type { Diagram } from '../../src/engine/types.ts';
import { solve } from '../../src/engine/index.ts';
import { parseGain } from '../../src/engine/polynomial/parse.ts';
import * as P from '../../src/engine/polynomial/polynomial.ts';
import type { Polynomial } from '../../src/engine/polynomial/polynomial.ts';

/** Resuelve exigiendo que el diagrama sea válido. */
export function solveOk(d: Diagram) {
  const s = solve(d);
  const errors = s.issues.filter((i) => i.level === 'error');
  expect(errors.map((e) => e.message), 'el diagrama debería ser válido').toEqual([]);
  expect(s.error).toBeNull();
  if (!s.result) throw new Error('sin resultado');
  return s.result;
}

/**
 * Compara polinomios por igualdad algebraica, no por cadena: el orden de los
 * términos en la salida no forma parte del contrato.
 */
export function expectPoly(actual: Polynomial, expected: string): void {
  const want = parseGain(expected);
  expect(
    P.toString(actual),
    `se esperaba ${P.toString(want)} y se obtuvo ${P.toString(actual)}`,
  ).toBe(P.toString(want));
}

/** Comprueba una función de transferencia completa. */
export function expectTransfer(d: Diagram, num: string, den: string) {
  const r = solveOk(d);
  expectPoly(r.numerator, num);
  expectPoly(r.denominator, den);
  return r;
}

/** Ganancias de los caminos o lazos, como cadenas ordenadas para comparar sin depender del orden. */
export const gains = (walks: readonly { gain: Polynomial }[]): string[] =>
  walks.map((w) => P.toString(w.gain)).sort();
