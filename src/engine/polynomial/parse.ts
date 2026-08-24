import type { Polynomial } from './polynomial.ts';
import { add, constant, mul, one, sub, symbol } from './polynomial.ts';
import { rat } from './rational.ts';

/**
 * Parser mínimo de expresiones de ganancia: símbolos, enteros, + - * ^ y paréntesis.
 * No admite división: una ganancia como `1/G` no puede representarse como polinomio
 * y no hace falta en Fase 1 (Mason nunca divide).
 */
export function parseGain(src: string): Polynomial {
  const p = new Parser(src);
  const result = p.parseExpr();
  p.expectEnd();
  return result;
}

/** Símbolos que aparecen en una expresión de ganancia. */
export function gainSymbols(src: string): string[] {
  const out = new Set<string>();
  for (const m of src.matchAll(/[A-Za-z][A-Za-z0-9_]*/g)) out.add(m[0]);
  return [...out];
}

class Parser {
  private i = 0;
  constructor(private readonly s: string) {}

  private ws() {
    while (this.i < this.s.length && /\s/.test(this.s[this.i]!)) this.i++;
  }

  private peek(): string | undefined {
    this.ws();
    return this.s[this.i];
  }

  private eat(ch: string): boolean {
    if (this.peek() === ch) {
      this.i++;
      return true;
    }
    return false;
  }

  expectEnd() {
    if (this.peek() !== undefined) {
      throw new Error(`Ganancia inválida: carácter inesperado "${this.peek()}" en "${this.s}"`);
    }
  }

  parseExpr(): Polynomial {
    let left = this.parseTerm();
    for (;;) {
      if (this.eat('+')) left = add(left, this.parseTerm());
      else if (this.eat('-')) left = sub(left, this.parseTerm());
      else return left;
    }
  }

  private parseTerm(): Polynomial {
    let left = this.parsePower();
    while (this.eat('*')) left = mul(left, this.parsePower());
    return left;
  }

  private parsePower(): Polynomial {
    const base = this.parseUnary();
    if (this.eat('^')) {
      const e = this.parseInteger();
      let out = one();
      for (let k = 0; k < e; k++) out = mul(out, base);
      return out;
    }
    return base;
  }

  private parseUnary(): Polynomial {
    if (this.eat('-')) return sub(constant(rat(0)), this.parseUnary());
    if (this.eat('+')) return this.parseUnary();
    return this.parseAtom();
  }

  private parseInteger(): number {
    this.ws();
    const start = this.i;
    while (this.i < this.s.length && /\d/.test(this.s[this.i]!)) this.i++;
    if (start === this.i) throw new Error(`Ganancia inválida: se esperaba un entero en "${this.s}"`);
    return Number(this.s.slice(start, this.i));
  }

  private parseAtom(): Polynomial {
    const c = this.peek();
    if (c === undefined) throw new Error(`Ganancia inválida: expresión incompleta "${this.s}"`);
    if (c === '(') {
      this.i++;
      const inner = this.parseExpr();
      if (!this.eat(')')) throw new Error(`Ganancia inválida: falta ")" en "${this.s}"`);
      return inner;
    }
    if (/\d/.test(c)) return constant(rat(this.parseInteger()));
    if (/[A-Za-z]/.test(c)) {
      const start = this.i;
      while (this.i < this.s.length && /[A-Za-z0-9_]/.test(this.s[this.i]!)) this.i++;
      return symbol(this.s.slice(start, this.i));
    }
    throw new Error(`Ganancia inválida: carácter "${c}" en "${this.s}"`);
  }
}
