import { useEffect, useState } from 'react';
import type { Diagram } from '../engine/types.ts';
import type { Solution } from '../engine/index.ts';
import { solve } from '../engine/index.ts';

/**
 * Recalcula con debounce mientras se edita. Mason es rápido, pero el debounce
 * evita recalcular en cada tecla pulsada al escribir una ganancia.
 */
export function useSolution(diagram: Diagram, delay = 120): Solution {
  const [solution, setSolution] = useState<Solution>(() => solve(diagram));

  useEffect(() => {
    const t = setTimeout(() => setSolution(solve(diagram)), delay);
    return () => clearTimeout(t);
  }, [diagram, delay]);

  return solution;
}
