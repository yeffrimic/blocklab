import type { Polynomial } from './polynomial.ts';
import {
  add,
  divideExact,
  equals,
  isZeroPoly,
  rendersNegative,
  mul,
  negate,
  one,
  sub,
  toLatexFactored,
  toStringFactored,
  zero,
} from './polynomial.ts';

/**
 * Función racional: cociente de dos polinomios multivariados.
 *
 * Mason no divide nunca, así que el motor no la necesitaba. La reducción paso a
 * paso sí: cerrar un lazo es exactamente dividir. No hay simplificación por MCD
 * multivariado — no hace falta, porque la comparación es por multiplicación
 * cruzada y el resultado se contrasta con Mason antes de enseñarlo.
 */
export interface Ratio {
  num: Polynomial;
  den: Polynomial;
}

export const fromPoly = (num: Polynomial): Ratio => ({ num, den: one() });
export const oneRatio = (): Ratio => ({ num: one(), den: one() });
export const zeroRatio = (): Ratio => ({ num: zero(), den: one() });

export const isOneRatio = (a: Ratio): boolean => equals(a.num, a.den);
export const isPolynomial = (a: Ratio): boolean => equals(a.den, one());

export const mulRatio = (a: Ratio, b: Ratio): Ratio => ({
  num: mul(a.num, b.num),
  den: mul(a.den, b.den),
});

export const addRatio = (a: Ratio, b: Ratio): Ratio =>
  equals(a.den, b.den)
    ? { num: add(a.num, b.num), den: a.den }
    : { num: add(mul(a.num, b.den), mul(b.num, a.den)), den: mul(a.den, b.den) };

/**
 * Cierra un lazo de ganancia `loop` sobre la rama `g`: `g / (1 - loop)`.
 *
 * El signo ya viaja dentro de `loop` — un lazo de realimentación negativa vale
 * `-GH`, así que el denominador sale `1 + GH` sin tener que decidir nada aquí.
 */
export function closeLoop(g: Ratio, loop: Ratio): Ratio {
  // 1 - n/d = (d - n)/d, así que g / (1 - loop) = g · d / (d - n).
  const factor = sub(loop.den, loop.num);
  return { num: mul(g.num, loop.den), den: mul(g.den, factor) };
}

/**
 * Cancela los factores comunes que se le pasen y deja el menos arriba.
 *
 * Sin esto la reducción devuelve resultados correctos pero monstruosos: cada
 * lazo cerrado mete un denominador que después reaparece arriba y ya no se va
 * solo. No es una simplificación general — solo prueba los candidatos que la
 * propia reducción ha ido generando, que son justo los que sobran.
 */
// El parámetro es un array a propósito: con un iterador de un solo uso, el
// bucle de reintento de abajo lo encontraría agotado en la segunda vuelta y
// cancelaría un único factor en vez de todos.
export function cancel(a: Ratio, candidates: readonly Polynomial[]): Ratio {
  let { num, den } = a;

  if (isZeroPoly(num)) return { num, den: one() };

  let again = true;
  while (again) {
    again = false;
    for (const f of candidates) {
      if (isZeroPoly(f) || equals(f, one())) continue;
      const n = divideExact(num, f);
      if (!n) continue;
      const d = divideExact(den, f);
      if (!d) continue;
      num = n;
      den = d;
      again = true;
    }
  }

  // Si el denominador divide al numerador, nunca hubo fracción.
  const whole = divideExact(num, den);
  if (whole) return { num: whole, den: one() };

  // `(-1 - G) / (1 + G)` se lee fatal; el signo vive arriba.
  if (rendersNegative(den)) return { num: negate(num), den: negate(den) };

  return { num, den };
}

/** Igualdad exacta por multiplicación cruzada; no necesita MCD. */
export const equalsRatio = (a: Ratio, b: Ratio): boolean =>
  equals(mul(a.num, b.den), mul(b.num, a.den));

export const isZeroRatio = (a: Ratio): boolean => isZeroPoly(a.num);

const render = (a: Ratio, poly: (p: Polynomial) => string, frac: (n: string, d: string) => string): string =>
  equals(a.den, one()) ? poly(a.num) : frac(poly(a.num), poly(a.den));

export const ratioToString = (a: Ratio): string =>
  render(a, toStringFactored, (n, d) => `(${n}) / (${d})`);

export const ratioToLatex = (a: Ratio): string =>
  render(a, toLatexFactored, (n, d) => `\\frac{${n}}{${d}}`);
