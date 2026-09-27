import type { Diagram } from './types.ts';
import type { Issue } from './validate.ts';
import { hasErrors, validate } from './validate.ts';
import type { Sfg } from './sfg/types.ts';
import { buildSfg } from './sfg/build.ts';
import type { MasonResult } from './mason.ts';
import { mason } from './mason.ts';
import type { Reduction } from './reduce.ts';
import { naming, reduce } from './reduce.ts';

export interface Solution {
  issues: Issue[];
  /** null si la validación encontró errores. */
  sfg: Sfg | null;
  result: MasonResult | null;
  /**
   * La reducción narrada paso a paso. Es capa de presentación: se contrasta con
   * Mason (`matchesMason`) y el panel se calla si no cuadra.
   */
  reduction: Reduction | null;
  /** Fallo inesperado del constructor de SFG o del motor. */
  error: string | null;
}

/** Punto de entrada único: valida, construye el SFG y aplica Mason. */
export function solve(d: Diagram): Solution {
  const issues = validate(d);
  if (hasErrors(issues)) return { issues, sfg: null, result: null, reduction: null, error: null };
  try {
    const sfg = buildSfg(d);
    const result = mason(sfg);
    return { issues, sfg, result, reduction: reduce(sfg, result, naming(d)), error: null };
  } catch (e) {
    return { issues, sfg: null, result: null, reduction: null, error: (e as Error).message };
  }
}

export * from './types.ts';
export * from './validate.ts';
export * from './mason.ts';
export * from './examples.ts';
export * from './reduce.ts';
export * from './polynomial/ratio.ts';
export { buildSfg } from './sfg/build.ts';
export type { Sfg, SfgEdge, WeightedWalk } from './sfg/types.ts';
export { forwardPaths } from './sfg/paths.ts';
export { elementaryLoops } from './sfg/loops.ts';
export { nonTouchingSets } from './sfg/nontouching.ts';
export * as Poly from './polynomial/polynomial.ts';
export { parseGain, gainSymbols } from './polynomial/parse.ts';
export * from './polynomial/rational.ts';
