import { describe, expect, it } from 'vitest';
import {
  INVALID_FREE_PORT,
  INVALID_NO_SINK,
  INVALID_SELF_LOOP,
  INVALID_UNDECLARED,
  INVALID_UNREACHABLE,
  T7,
} from '../../src/engine/examples.ts';
import { solve } from '../../src/engine/index.ts';
import { validate } from '../../src/engine/validate.ts';
import type { Diagram } from '../../src/engine/types.ts';

const codes = (d: Diagram) => validate(d).filter((i) => i.level === 'error').map((i) => i.code);
const messages = (d: Diagram) => validate(d).map((i) => i.message);

describe('T8 — diagramas inválidos', () => {
  it('sin salida', () => {
    expect(codes(INVALID_NO_SINK)).toContain('no-sink');
    expect(messages(INVALID_NO_SINK)).toContain('Agrega una salida.');
  });

  it('sumador con puerto libre', () => {
    expect(codes(INVALID_FREE_PORT)).toContain('sum-free-port');
    expect(messages(INVALID_FREE_PORT)).toContain('El sumador tiene un puerto libre (−).');
  });

  it('símbolo no declarado', () => {
    expect(codes(INVALID_UNDECLARED)).toContain('symbol-undeclared');
    expect(messages(INVALID_UNDECLARED)).toContain('G8 no está definido.');
  });

  it('la entrada no alcanza la salida', () => {
    expect(codes(INVALID_UNREACHABLE)).toContain('no-path');
    expect(messages(INVALID_UNREACHABLE)).toContain('La entrada no llega a la salida.');
  });

  it('bloque realimentado sobre sí mismo', () => {
    expect(codes(INVALID_SELF_LOOP)).toContain('block-self-loop');
  });

  it('cada diagrama inválido produce un error específico, no un fallo genérico', () => {
    for (const d of [INVALID_NO_SINK, INVALID_FREE_PORT, INVALID_UNDECLARED, INVALID_UNREACHABLE, INVALID_SELF_LOOP]) {
      const s = solve(d);
      expect(s.result).toBeNull();
      expect(s.error).toBeNull(); // el error se reporta como Issue, no como excepción
      expect(s.issues.some((i) => i.level === 'error')).toBe(true);
    }
  });
});

describe('diagramas válidos', () => {
  it('T7 no produce errores', () => {
    expect(codes(T7)).toEqual([]);
  });
});
