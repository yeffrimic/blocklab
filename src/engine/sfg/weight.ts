import type { Polynomial } from '../polynomial/polynomial.ts';
import { constant, mul, one } from '../polynomial/polynomial.ts';
import { rat } from '../polynomial/rational.ts';
import { parseGain } from '../polynomial/parse.ts';
import type { SfgEdge } from './types.ts';

const MINUS_ONE = constant(rat(-1));
const cache = new Map<string, Polynomial>();

function gainPoly(expr: string): Polynomial {
  let p = cache.get(expr);
  if (!p) {
    p = parseGain(expr);
    cache.set(expr, p);
  }
  return p;
}

/**
 * Peso de una arista del SFG: producto de sus ganancias por el signo del puerto
 * de sumador en el que termina. El signo viaja siempre dentro del peso; de ahí
 * que un lazo de realimentación negativa dé L = -GH y por tanto Δ = 1 + GH.
 */
export function edgeWeight(e: SfgEdge): Polynomial {
  let p = e.sign === -1 ? MINUS_ONE : one();
  for (const g of e.gain) p = mul(p, gainPoly(g));
  return p;
}

export const walkWeight = (edges: readonly SfgEdge[]): Polynomial =>
  edges.reduce((acc, e) => mul(acc, edgeWeight(e)), one());
