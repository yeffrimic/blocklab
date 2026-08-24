import type { Rational } from './rational.ts';
import { ONE, mulR } from './rational.ts';

/** Un monomio: coeficiente racional exacto por un producto de símbolos con exponente. */
export interface Monomial {
  coeff: Rational;
  vars: ReadonlyMap<string, number>;
}

/**
 * Clave canónica: símbolos en orden alfabético con su exponente.
 * `G3*G1^2` y `G1^2*G3` deben colapsar a la misma clave o los términos no se combinan.
 */
export function monoKey(vars: ReadonlyMap<string, number>): string {
  const parts: string[] = [];
  for (const name of [...vars.keys()].sort()) {
    const e = vars.get(name)!;
    if (e === 0) continue;
    parts.push(e === 1 ? name : `${name}^${e}`);
  }
  return parts.length ? parts.join('*') : '1';
}

export function mono(coeff: Rational, vars: Iterable<[string, number]> = []): Monomial {
  const m = new Map<string, number>();
  for (const [k, e] of vars) {
    if (e === 0) continue;
    m.set(k, (m.get(k) ?? 0) + e);
  }
  for (const [k, e] of [...m]) if (e === 0) m.delete(k);
  return { coeff, vars: m };
}

export function mulMono(a: Monomial, b: Monomial): Monomial {
  const vars = new Map(a.vars);
  for (const [k, e] of b.vars) vars.set(k, (vars.get(k) ?? 0) + e);
  for (const [k, e] of [...vars]) if (e === 0) vars.delete(k);
  return { coeff: mulR(a.coeff, b.coeff), vars };
}

export const symbolMono = (name: string): Monomial => mono(ONE, [[name, 1]]);
