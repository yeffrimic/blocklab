import type { WeightedWalk } from './types.ts';

/** Un conjunto de lazos que no comparten ningún nodo entre sí. */
export interface NonTouchingSet {
  /** Índices dentro del arreglo de lazos. */
  loops: number[];
  /** Unión de las máscaras de nodos. */
  mask: bigint;
}

/**
 * Enumera todos los conjuntos de lazos mutuamente no adyacentes de tamaño >= 2.
 * Dos lazos son no adyacentes si sus bitmasks de nodos no se intersectan.
 */
export function nonTouchingSets(loops: readonly WeightedWalk[], maxSize = 32): NonTouchingSet[] {
  const out: NonTouchingSet[] = [];
  const chosen: number[] = [];

  const walk = (start: number, mask: bigint): void => {
    for (let i = start; i < loops.length; i++) {
      const m = loops[i]!.mask;
      if ((m & mask) !== 0n) continue;
      chosen.push(i);
      const union = mask | m;
      if (chosen.length >= 2) out.push({ loops: [...chosen], mask: union });
      if (chosen.length < maxSize) walk(i + 1, union);
      chosen.pop();
    }
  };

  walk(0, 0n);
  return out;
}
