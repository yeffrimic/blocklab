import type { Polynomial } from './polynomial/polynomial.ts';
import {
  add,
  equals,
  isZeroPoly,
  mulAll,
  negate,
  one,
  toLatexFactored,
  toStringFactored,
  zero,
} from './polynomial/polynomial.ts';
import type { Sfg, WeightedWalk } from './sfg/types.ts';
import { forwardPaths } from './sfg/paths.ts';
import { elementaryLoops } from './sfg/loops.ts';
import { nonTouchingSets } from './sfg/nontouching.ts';

export interface DeltaTerm {
  /** Cantidad de lazos del producto: 1 para -Li, 2 para +LiLj, etc. */
  size: number;
  /** Índices en `MasonResult.loops`. */
  loopIndices: number[];
  /** El término ya con su signo (-1)^size. */
  value: Polynomial;
}

export interface DeltaBreakdown {
  /** Términos además del 1 inicial, en orden de tamaño creciente. */
  terms: DeltaTerm[];
  value: Polynomial;
}

export interface MasonResult {
  numerator: Polynomial;
  denominator: Polynomial;
  paths: WeightedWalk[];
  /** Δk de cada camino, en el mismo orden que `paths`. */
  pathDeltas: DeltaBreakdown[];
  loops: WeightedWalk[];
  delta: DeltaBreakdown;
  warnings: string[];
}

/** Límite blando: por encima de esto la enumeración de conjuntos no adyacentes se dispara. */
export const LOOP_WARN_LIMIT = 25;
export const LOOP_HARD_LIMIT = 40;

/**
 * Δ = 1 - ΣLi + Σ(no adyacentes) LiLj - ... sobre el subconjunto de lazos indicado.
 * `subset` son índices dentro de `allLoops`, para que los Δk puedan referirse a
 * los mismos lazos que el Δ global.
 */
export function computeDelta(allLoops: readonly WeightedWalk[], subset: number[]): DeltaBreakdown {
  const loops = subset.map((i) => allLoops[i]!);
  const terms: DeltaTerm[] = [];

  for (let i = 0; i < loops.length; i++) {
    terms.push({ size: 1, loopIndices: [subset[i]!], value: negate(loops[i]!.gain) });
  }

  const sets = nonTouchingSets(loops);
  sets.sort((a, b) => a.loops.length - b.loops.length);
  for (const s of sets) {
    const product = mulAll(s.loops.map((i) => loops[i]!.gain));
    const value = s.loops.length % 2 === 0 ? product : negate(product);
    terms.push({ size: s.loops.length, loopIndices: s.loops.map((i) => subset[i]!), value });
  }

  terms.sort((a, b) => a.size - b.size);
  let value = one();
  for (const t of terms) value = add(value, t.value);
  return { terms, value };
}

/** Fórmula de Mason: T = ΣPkΔk / Δ. Fuente de verdad del proyecto. */
export function mason(sfg: Sfg): MasonResult {
  const warnings: string[] = [];
  const paths = forwardPaths(sfg);
  let loops = elementaryLoops(sfg);

  if (loops.length > LOOP_HARD_LIMIT) {
    warnings.push(
      `El diagrama tiene ${loops.length} lazos; se truncó en ${LOOP_HARD_LIMIT} para evitar una explosión combinatoria. El resultado no es confiable.`,
    );
    loops = loops.slice(0, LOOP_HARD_LIMIT);
  } else if (loops.length > LOOP_WARN_LIMIT) {
    warnings.push(`El diagrama tiene ${loops.length} lazos; el cálculo puede tardar.`);
  }

  const delta = computeDelta(loops, loops.map((_, i) => i));

  const pathDeltas: DeltaBreakdown[] = [];
  let numerator = zero();
  for (const p of paths) {
    const untouched: number[] = [];
    for (let i = 0; i < loops.length; i++) if ((loops[i]!.mask & p.mask) === 0n) untouched.push(i);
    const dk = computeDelta(loops, untouched);
    pathDeltas.push(dk);
    numerator = add(numerator, mulAll([p.gain, dk.value]));
  }

  if (!paths.length) warnings.push('No hay ningún camino directo de la entrada a la salida.');

  if (isZeroPoly(delta.value)) {
    warnings.push(
      'Δ = 0: la ganancia de lazo vale exactamente 1, así que el denominador se anula y el ' +
        'sistema no tiene función de transferencia. Suele ser un signo de sumador al revés.',
    );
  }

  return { numerator, denominator: delta.value, paths, pathDeltas, loops, delta, warnings };
}

/**
 * Δ = 0. No es un resultado, es un sistema sin función de transferencia: pasa
 * cuando la ganancia de lazo vale justo 1. Enseñar `algo / 0` como si fuera la
 * respuesta sería peor que no enseñar nada.
 */
export const isSingular = (r: MasonResult): boolean => isZeroPoly(r.denominator);

/** Sin lazos, Δ = 1: dividir entre 1 solo estorba. */
const trivialDenominator = (r: MasonResult): boolean => equals(r.denominator, one());

/**
 * El resultado se presenta con el factor común sacado, como en cualquier libro:
 * `G1G2 / (1 + G1G2(G3 + G4))`, no la forma expandida. El desglose de Δ del
 * panel sí se queda expandido: ahí el término a término es justo lo que se explica.
 */
export const resultToString = (r: MasonResult): string =>
  trivialDenominator(r)
    ? toStringFactored(r.numerator)
    : `(${toStringFactored(r.numerator)}) / (${toStringFactored(r.denominator)})`;

export const resultToLatex = (r: MasonResult): string =>
  trivialDenominator(r)
    ? toLatexFactored(r.numerator)
    : `\\frac{${toLatexFactored(r.numerator)}}{${toLatexFactored(r.denominator)}}`;

export type { Polynomial };
