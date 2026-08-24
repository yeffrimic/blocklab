import { describe, expect, it } from 'vitest';
import * as P from '../../src/engine/polynomial/polynomial.ts';
import { parseGain } from '../../src/engine/polynomial/parse.ts';
import { addR, rat, ratToString } from '../../src/engine/polynomial/rational.ts';
import { monoKey } from '../../src/engine/polynomial/monomial.ts';

describe('racionales exactos', () => {
  it('1/3 + 1/6 = 1/2 sin ruido de punto flotante', () => {
    expect(ratToString(addR(rat(1, 3), rat(1, 6)))).toBe('1/2');
  });

  it('normaliza el signo al numerador', () => {
    expect(ratToString(rat(1, -2))).toBe('-1/2');
  });
});

describe('clave canónica del monomio', () => {
  it('G3*G1^2 y G1^2*G3 producen la misma clave', () => {
    const a = new Map([['G3', 1], ['G1', 2]]);
    const b = new Map([['G1', 2], ['G3', 1]]);
    expect(monoKey(a)).toBe(monoKey(b));
    expect(monoKey(a)).toBe('G1^2*G3');
  });
});

describe('álgebra de polinomios', () => {
  it('combina términos semejantes escritos en distinto orden', () => {
    const p = P.add(parseGain('G3*G1'), parseGain('G1*G3'));
    expect(P.toString(p)).toBe('2*G1*G3');
  });

  it('los términos opuestos se cancelan exactamente', () => {
    const p = P.sub(parseGain('G1*G2'), parseGain('G2*G1'));
    expect(P.isZeroPoly(p)).toBe(true);
    expect(P.toString(p)).toBe('0');
  });

  it('expande productos de sumas', () => {
    const p = P.mul(parseGain('1 + G1*H1'), parseGain('1 + G2*H2'));
    expect(P.equals(p, parseGain('1 + G1*H1 + G2*H2 + G1*G2*H1*H2'))).toBe(true);
  });
});

describe('parser de ganancias', () => {
  it('acepta expresiones con paréntesis y potencias', () => {
    expect(P.equals(parseGain('(G1 + G2)^2'), parseGain('G1^2 + 2*G1*G2 + G2^2'))).toBe(true);
  });

  it('acepta el unario negativo', () => {
    expect(P.toString(parseGain('-G1'))).toBe('-G1');
  });

  it('rechaza lo que no puede leer', () => {
    expect(() => parseGain('G1 /')).toThrow();
    expect(() => parseGain('(G1')).toThrow();
  });
});

describe('LaTeX', () => {
  it('pone los dígitos como subíndice', () => {
    expect(P.toLatex(parseGain('G1*G2 + H12'))).toBe('H_{12} + G_{1} G_{2}');
  });
});

describe('forma factorizada', () => {
  const factored = (src: string) => P.toStringFactored(parseGain(src));

  it('saca el factor común del denominador de Mason', () => {
    expect(factored('1 + G1*G2*G3 + G1*G2*G4')).toBe('1 + G1*G2*(G3 + G4)');
  });

  it('agrupa solo lo que comparte factor', () => {
    expect(factored('1 + G1*H1 + G1*G2*H2')).toBe('1 + G1*(H1 + G2*H2)');
  });

  it('deja intacto lo que no tiene factor común', () => {
    expect(factored('1 + G1')).toBe('1 + G1');
    expect(factored('G1 + G2 + G3')).toBe('G1 + G2 + G3');
  });

  it('saca el signo fuera del paréntesis cuando todo el grupo es negativo', () => {
    expect(factored('1 - G1*G2*G3 - G1*G2*G4')).toBe('1 - G1*G2*(G3 + G4)');
  });

  it('respeta los exponentes al dividir por el factor', () => {
    expect(factored('G1^2*G2 + G1^2*G3')).toBe('G1^{2}*(G2 + G3)');
    expect(factored('G1^3 + G1^2')).toBe('G1^{2}*(1 + G1)');
  });

  it('en LaTeX usa yuxtaposición, no asteriscos', () => {
    expect(P.toLatexFactored(parseGain('1 + G1*G2*G3 + G1*G2*G4'))).toBe(
      '1 + G_{1} G_{2} (G_{3} + G_{4})',
    );
  });

  // La propiedad que importa: factorizar es solo presentación, nunca álgebra nueva.
  it('es algebraicamente idéntica a la forma expandida', () => {
    const casos = [
      '1 + G1*G2*G3 + G1*G2*G4',
      '1 + G1*H1 + G2*H2 + G1*G2*H1*H2',
      '1 + G6 + G1*G2 + G1*G3 + G1*G2*G6 + G1*G3*G6 + G4*G6*G7 + G2*G5*G6*G7 + G3*G5*G6*G7',
      '1 - G1*G2*G3 - G1*G2*G4',
      '2*G1*G2 - 3*G1*G3',
      'G1^3 + G1^2 + G1',
    ];
    for (const src of casos) {
      const p = parseGain(src);
      // `^{n}` es la notación de salida; el parser lee `^n`.
      const back = parseGain(P.toStringFactored(p).replace(/\^\{(\d+)\}/g, '^$1'));
      expect(P.equals(back, p), `${src} -> ${P.toStringFactored(p)}`).toBe(true);
    }
  });
});
