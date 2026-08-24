import type { Rational } from './rational.ts';
import { ONE, addR, eq, isZero, negR, ratToString } from './rational.ts';
import type { Monomial } from './monomial.ts';
import { mono, monoKey, mulMono } from './monomial.ts';

/**
 * Un polinomio multivariado: suma de monomios indexada por clave canónica.
 * Solo se necesitan add/sub/mul: la fórmula de Mason nunca divide, así que
 * no hace falta MCD multivariado ni simplificación de fracciones.
 */
export type Polynomial = Map<string, Monomial>;

export const zero = (): Polynomial => new Map();
export const one = (): Polynomial => fromMonomial(mono(ONE));
export const constant = (c: Rational): Polynomial => fromMonomial(mono(c));
export const symbol = (name: string): Polynomial => fromMonomial(mono(ONE, [[name, 1]]));

export function fromMonomial(m: Monomial): Polynomial {
  if (isZero(m.coeff)) return new Map();
  return new Map([[monoKey(m.vars), m]]);
}

function insert(p: Polynomial, m: Monomial): void {
  if (isZero(m.coeff)) return;
  const k = monoKey(m.vars);
  const prev = p.get(k);
  if (!prev) {
    p.set(k, m);
    return;
  }
  const coeff = addR(prev.coeff, m.coeff);
  if (isZero(coeff)) p.delete(k);
  else p.set(k, { coeff, vars: prev.vars });
}

export function add(a: Polynomial, b: Polynomial): Polynomial {
  const out: Polynomial = new Map(a);
  for (const m of b.values()) insert(out, m);
  return out;
}

export const negate = (a: Polynomial): Polynomial =>
  new Map([...a].map(([k, m]) => [k, { coeff: negR(m.coeff), vars: m.vars }]));

export const sub = (a: Polynomial, b: Polynomial): Polynomial => add(a, negate(b));

export function mul(a: Polynomial, b: Polynomial): Polynomial {
  const out: Polynomial = new Map();
  for (const ma of a.values()) for (const mb of b.values()) insert(out, mulMono(ma, mb));
  return out;
}

export const mulAll = (ps: Polynomial[]): Polynomial => ps.reduce(mul, one());
export const addAll = (ps: Polynomial[]): Polynomial => ps.reduce(add, zero());

export const isZeroPoly = (a: Polynomial): boolean => a.size === 0;

export function equals(a: Polynomial, b: Polynomial): boolean {
  if (a.size !== b.size) return false;
  for (const [k, m] of a) {
    const o = b.get(k);
    if (!o || !eq(m.coeff, o.coeff)) return false;
  }
  return true;
}

const degree = (m: Monomial): number => [...m.vars.values()].reduce((s, e) => s + e, 0);

/** Orden de presentación: constante primero, luego por grado y alfabéticamente. */
export function terms(p: Polynomial): Monomial[] {
  return sortMonomials([...p.values()]);
}

function sortMonomials(ms: Monomial[]): Monomial[] {
  return [...ms].sort((x, y) => {
    const d = degree(x) - degree(y);
    if (d !== 0) return d;
    return monoKey(x.vars).localeCompare(monoKey(y.vars));
  });
}

function varsBody(vars: ReadonlyMap<string, number>, latex: boolean): string {
  const parts: string[] = [];
  for (const name of [...vars.keys()].sort()) {
    const e = vars.get(name)!;
    const base = latex ? latexSymbol(name) : name;
    parts.push(e === 1 ? base : `${base}^{${e}}`);
  }
  return parts.join(latex ? ' ' : '*');
}

const monoBody = (m: Monomial, latex: boolean): string => varsBody(m.vars, latex);

/** `G1` -> `G_{1}`, `H12` -> `H_{12}`, `K` -> `K`. */
function latexSymbol(name: string): string {
  const m = /^([A-Za-z]+)(\d+)$/.exec(name);
  return m ? `${m[1]}_{${m[2]}}` : name;
}

/** Un sumando ya renderizado, con el signo aparte para poder unirlo con ` + ` o ` - `. */
interface Piece {
  neg: boolean;
  text: string;
}

function plainPiece(m: Monomial, latex: boolean): Piece {
  const neg = m.coeff.n < 0n;
  const abs: Rational = neg ? negR(m.coeff) : m.coeff;
  const body = monoBody(m, latex);
  const coeffStr = eq(abs, ONE) && body ? '' : ratToString(abs);
  const sep = coeffStr && body ? (latex ? ' ' : '*') : '';
  return { neg, text: `${coeffStr}${sep}${body}` || '1' };
}

const joinPieces = (ps: Piece[]): string =>
  ps.reduce((out, p, i) => out + (i === 0 ? (p.neg ? '-' : '') : p.neg ? ' - ' : ' + ') + p.text, '');

function render(p: Polynomial, latex: boolean): string {
  const ts = terms(p);
  if (!ts.length) return '0';
  return joinPieces(ts.map((m) => plainPiece(m, latex)));
}

export const toString = (p: Polynomial): string => render(p, false);
export const toLatex = (p: Polynomial): string => render(p, true);

// --- Forma factorizada ------------------------------------------------------
// Sacar factor común es lo que hace cualquier libro de control al escribir el
// denominador: `1 + G1G2G3 + G1G2G4` se lee mucho peor que `1 + G1G2(G3 + G4)`.
// No es factorización general (nadie espera ver el denominador como producto de
// binomios), solo el máximo factor monomial común a un subconjunto de términos.

const totalDegree = (vars: ReadonlyMap<string, number>): number =>
  [...vars.values()].reduce((s, e) => s + e, 0);

/** Factor monomial común: mínimo exponente símbolo a símbolo. */
function gcdVars(a: ReadonlyMap<string, number>, b: ReadonlyMap<string, number>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [name, e] of a) {
    const f = b.get(name);
    if (f !== undefined) out.set(name, Math.min(e, f));
  }
  return out;
}

const dividesVars = (f: ReadonlyMap<string, number>, m: ReadonlyMap<string, number>): boolean => {
  for (const [name, e] of f) if ((m.get(name) ?? 0) < e) return false;
  return true;
};

function divideMono(m: Monomial, f: ReadonlyMap<string, number>, flipSign: boolean): Monomial {
  const vars = new Map(m.vars);
  for (const [name, e] of f) {
    const left = vars.get(name)! - e;
    if (left === 0) vars.delete(name);
    else vars.set(name, left);
  }
  return { coeff: flipSign ? negR(m.coeff) : m.coeff, vars };
}

/**
 * El factor común que más repetición ahorra: el que multiplica más términos y
 * saca más símbolos de dentro. Devuelve null si no hay ninguno que agrupe ≥2.
 */
function bestFactor(ts: Monomial[]): { vars: Map<string, number>; idx: number[] } | null {
  let best: { vars: Map<string, number>; idx: number[] } | null = null;
  let bestScore = 0;
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      const vars = gcdVars(ts[i]!.vars, ts[j]!.vars);
      const deg = totalDegree(vars);
      if (deg === 0) continue;
      const idx: number[] = [];
      for (let k = 0; k < ts.length; k++) if (dividesVars(vars, ts[k]!.vars)) idx.push(k);
      const score = (idx.length - 1) * deg;
      if (score > bestScore) {
        best = { vars, idx };
        bestScore = score;
      }
    }
  }
  return best;
}

function factoredPieces(ts: Monomial[], latex: boolean): Piece[] {
  const f = bestFactor(ts);
  if (!f) return ts.map((m) => plainPiece(m, latex));

  const inGroup = new Set(f.idx);
  const group = f.idx.map((k) => ts[k]!);
  const rest = ts.filter((_, k) => !inGroup.has(k));

  // Si todos los términos agrupados son negativos, el signo sale fuera del paréntesis.
  const allNeg = group.every((m) => m.coeff.n < 0n);
  const cofactor = sortMonomials(group.map((m) => divideMono(m, f.vars, allNeg)));

  const head = varsBody(f.vars, latex);
  const inner = joinPieces(factoredPieces(cofactor, latex));
  const sep = latex ? ' ' : '*';
  return [...factoredPieces(rest, latex), { neg: allNeg, text: `${head}${sep}(${inner})` }];
}

function renderFactored(p: Polynomial, latex: boolean): string {
  const ts = terms(p);
  if (!ts.length) return '0';
  return joinPieces(factoredPieces(ts, latex));
}

/** Como `toString`/`toLatex`, pero sacando factor común (`1 + G1G2(G3 + G4)`). */
export const toStringFactored = (p: Polynomial): string => renderFactored(p, false);
export const toLatexFactored = (p: Polynomial): string => renderFactored(p, true);

