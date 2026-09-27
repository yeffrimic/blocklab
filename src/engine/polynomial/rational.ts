/** Aritmética racional exacta sobre bigint. Sin floats en ningún punto del motor. */

export interface Rational {
  readonly n: bigint; // numerador (lleva el signo)
  readonly d: bigint; // denominador, siempre > 0
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function rat(n: bigint | number, d: bigint | number = 1n): Rational {
  let nn = BigInt(n);
  let dd = BigInt(d);
  if (dd === 0n) throw new Error('Rational: denominador cero');
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  if (nn === 0n) return { n: 0n, d: 1n };
  const g = gcd(nn, dd);
  return { n: nn / g, d: dd / g };
}

export const ZERO: Rational = { n: 0n, d: 1n };
export const ONE: Rational = { n: 1n, d: 1n };

export const isZero = (a: Rational): boolean => a.n === 0n;
export const eq = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d;

export const addR = (a: Rational, b: Rational): Rational => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const subR = (a: Rational, b: Rational): Rational => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const mulR = (a: Rational, b: Rational): Rational => rat(a.n * b.n, a.d * b.d);
export const negR = (a: Rational): Rational => ({ n: -a.n, d: a.d });

export function divR(a: Rational, b: Rational): Rational {
  if (b.n === 0n) throw new Error('Rational: división entre cero');
  return rat(a.n * b.d, a.d * b.n);
}

export function ratToString(a: Rational): string {
  return a.d === 1n ? a.n.toString() : `${a.n}/${a.d}`;
}

/** Solo para graficar / análisis numérico. Nunca dentro del motor simbólico. */
export const ratToNumber = (a: Rational): number => Number(a.n) / Number(a.d);
