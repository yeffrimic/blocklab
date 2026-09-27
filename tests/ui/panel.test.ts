import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Diagram } from '../../src/engine/types.ts';
import { solve } from '../../src/engine/index.ts';
import { T3, T5, T7 } from '../../src/engine/examples.ts';
import { ReductionPanel } from '../../src/ui/Reduction/ReductionPanel.tsx';

/**
 * Prueba de humo sin DOM: `renderToStaticMarkup` basta para detectar que el
 * panel se cae al montarse, que es el fallo que ni el typecheck ni las pruebas
 * del motor pueden ver.
 */
const html = (d: Diagram): string => {
  const s = solve(d);
  expect(s.reduction, 'el diagrama debería reducirse').not.toBeNull();
  return renderToStaticMarkup(createElement(ReductionPanel, { reduction: s.reduction! }));
};

describe('panel de pasos', () => {
  it('se renderiza para un lazo simple', () => {
    const out = html(T3);
    expect(out).toContain('El diagrama, como grafo');
    expect(out).toContain('Lazo cerrado');
    expect(out).toContain('reduction-steps');
  });

  it('dibuja un nodo del grafo por cada nodo del SFG', () => {
    const s = solve(T5);
    const out = renderToStaticMarkup(createElement(ReductionPanel, { reduction: s.reduction! }));
    for (const n of s.sfg!.nodes) expect(out, `falta el nodo ${n}`).toContain(`>${n}</text>`);
  });

  it('aguanta el diagrama entrelazado', () => {
    const out = html(T7);
    expect(out).toContain('Ramas en paralelo');
    expect(out).toContain('graph-view');
  });

  it('cierra con el resultado', () => {
    expect(html(T5)).toContain('Queda');
  });
});
