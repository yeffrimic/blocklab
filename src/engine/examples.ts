import type { Diagram, DiagramEdge, DiagramNode, Sign, SumPort } from './types.ts';

/* Constructores breves para escribir diagramas a mano sin ruido. */
const src = (id: string, label: string, x: number, y: number): DiagramNode => ({ id, kind: 'source', label, pos: { x, y } });
const snk = (id: string, label: string, x: number, y: number): DiagramNode => ({ id, kind: 'sink', label, pos: { x, y } });
const blk = (id: string, gain: string, x: number, y: number): DiagramNode => ({ id, kind: 'block', gain, pos: { x, y } });
const pick = (id: string, x: number, y: number): DiagramNode => ({ id, kind: 'pickoff', pos: { x, y } });
const sum = (id: string, signs: Sign[], x: number, y: number): DiagramNode => ({
  id,
  kind: 'sum',
  ports: signs.map((sign, i): SumPort => ({ id: `p${i + 1}`, sign })),
  pos: { x, y },
});
const e = (from: string, to: string, toPort?: string): DiagramEdge => ({
  id: `${from}->${to}${toPort ? `:${toPort}` : ''}`,
  from,
  to,
  ...(toPort ? { toPort } : {}),
});
const syms = (...names: string[]) => names.map((name) => ({ name }));

export interface Example {
  id: string;
  name: string;
  description: string;
  diagram: Diagram;
}

/** T1 — Serie. Esperado: G1*G2 */
export const T1: Diagram = {
  version: 1,
  nodes: [src('R', 'R', 0, 100), blk('b1', 'G1', 140, 100), blk('b2', 'G2', 300, 100), snk('C', 'C', 460, 100)],
  edges: [e('R', 'b1'), e('b1', 'b2'), e('b2', 'C')],
  symbols: syms('G1', 'G2'),
};

/** T2 — Paralelo. Esperado: G1 + G2 */
export const T2: Diagram = {
  version: 1,
  nodes: [
    src('R', 'R', 0, 120),
    pick('p', 120, 120),
    blk('b1', 'G1', 240, 60),
    blk('b2', 'G2', 240, 180),
    sum('s', [1, 1], 400, 120),
    snk('C', 'C', 520, 120),
  ],
  edges: [e('R', 'p'), e('p', 'b1'), e('p', 'b2'), e('b1', 's', 'p1'), e('b2', 's', 'p2'), e('s', 'C')],
  symbols: syms('G1', 'G2'),
};

const feedbackLoop = (sign: Sign): Diagram => ({
  version: 1,
  nodes: [
    src('R', 'R', 0, 100),
    sum('s', [1, sign], 120, 100),
    blk('b1', 'G1', 260, 100),
    pick('p', 400, 100),
    snk('C', 'C', 520, 100),
  ],
  edges: [e('R', 's', 'p1'), e('s', 'b1'), e('b1', 'p'), e('p', 'C'), e('p', 's', 'p2')],
  symbols: syms('G1'),
});

/** T3 — Realimentación negativa unitaria. Esperado: G1 / (1 + G1) */
export const T3: Diagram = feedbackLoop(-1);

/** T4 — Realimentación positiva. Esperado: G1 / (1 - G1) */
export const T4: Diagram = feedbackLoop(1);

/** T5 — Lazos anidados. Esperado: G1*G2 / (1 + G1*H1 + G1*G2*H2) */
export const T5: Diagram = {
  version: 1,
  nodes: [
    src('R', 'R', 0, 100),
    sum('s1', [1, -1], 100, 100),
    sum('s2', [1, -1], 220, 100),
    blk('bG1', 'G1', 340, 100),
    pick('p1', 460, 100),
    blk('bG2', 'G2', 560, 100),
    pick('p2', 680, 100),
    snk('C', 'C', 780, 100),
    blk('bH1', 'H1', 460, 210),
    blk('bH2', 'H2', 460, 300),
  ],
  edges: [
    e('R', 's1', 'p1'),
    e('s1', 's2', 'p1'),
    e('s2', 'bG1'),
    e('bG1', 'p1'),
    e('p1', 'bG2'),
    e('bG2', 'p2'),
    e('p2', 'C'),
    e('p1', 'bH1'),
    e('bH1', 's2', 'p2'),
    e('p2', 'bH2'),
    e('bH2', 's1', 'p2'),
  ],
  symbols: syms('G1', 'G2', 'H1', 'H2'),
};

/** T6 — Lazos no adyacentes. Denominador: 1 + G1*H1 + G2*H2 + G1*G2*H1*H2 */
export const T6: Diagram = {
  version: 1,
  nodes: [
    src('R', 'R', 0, 100),
    sum('s1', [1, -1], 100, 100),
    blk('bG1', 'G1', 220, 100),
    pick('p1', 340, 100),
    sum('s2', [1, -1], 440, 100),
    blk('bG2', 'G2', 560, 100),
    pick('p2', 680, 100),
    snk('C', 'C', 780, 100),
    blk('bH1', 'H1', 220, 210),
    blk('bH2', 'H2', 560, 210),
  ],
  edges: [
    e('R', 's1', 'p1'),
    e('s1', 'bG1'),
    e('bG1', 'p1'),
    e('p1', 's2', 'p1'),
    e('s2', 'bG2'),
    e('bG2', 'p2'),
    e('p2', 'C'),
    e('p1', 'bH1'),
    e('bH1', 's1', 'p2'),
    e('p2', 'bH2'),
    e('bH2', 's2', 'p2'),
  ],
  symbols: syms('G1', 'G2', 'H1', 'H2'),
};

/**
 * T7 — Caso de referencia (examen).
 * Numerador:   G2*G5*G6 + G3*G5*G6 + G4*G6
 * Denominador: 1 + G1*G2 + G1*G3 + G6 + G1*G2*G6 + G1*G3*G6
 *                + G2*G5*G6*G7 + G3*G5*G6*G7 + G4*G6*G7
 */
export const T7: Diagram = {
  version: 1,
  nodes: [
    src('R', 'R', 0, 200),
    sum('S1', [1, -1, -1], 100, 200),
    pick('pA', 200, 200),
    blk('bG2', 'G2', 320, 140),
    blk('bG3', 'G3', 320, 260),
    sum('S2', [1, 1], 460, 200),
    pick('pB', 560, 200),
    blk('bG5', 'G5', 660, 200),
    blk('bG4', 'G4', 480, 40),
    sum('S3', [1, 1, -1], 800, 200),
    blk('bG6', 'G6', 900, 200),
    pick('pC', 1000, 200),
    snk('C', 'C', 1120, 200),
    blk('bG1', 'G1', 400, 360),
    blk('bG7', 'G7', 560, 460),
  ],
  edges: [
    e('R', 'S1', 'p1'),
    e('S1', 'pA'),
    e('pA', 'bG2'),
    e('pA', 'bG3'),
    e('bG2', 'S2', 'p1'),
    e('bG3', 'S2', 'p2'),
    e('S2', 'pB'),
    e('pB', 'bG5'),
    e('bG5', 'S3', 'p1'),
    e('pA', 'bG4'),
    e('bG4', 'S3', 'p2'),
    e('S3', 'bG6'),
    e('bG6', 'pC'),
    e('pC', 'C'),
    e('pC', 'S3', 'p3'),
    e('pB', 'bG1'),
    e('bG1', 'S1', 'p2'),
    e('pC', 'bG7'),
    e('bG7', 'S1', 'p3'),
  ],
  symbols: syms('G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7'),
};

/* T8 — Diagramas inválidos, uno por clase de error. */

export const INVALID_NO_SINK: Diagram = {
  version: 1,
  nodes: [src('R', 'R', 0, 100), blk('b1', 'G1', 140, 100)],
  edges: [e('R', 'b1')],
  symbols: syms('G1'),
};

export const INVALID_FREE_PORT: Diagram = {
  version: 1,
  nodes: [src('R', 'R', 0, 100), sum('s', [1, -1], 120, 100), blk('b1', 'G1', 260, 100), snk('C', 'C', 400, 100)],
  edges: [e('R', 's', 'p1'), e('s', 'b1'), e('b1', 'C')],
  symbols: syms('G1'),
};

export const INVALID_UNDECLARED: Diagram = {
  version: 1,
  nodes: [src('R', 'R', 0, 100), blk('b1', 'G8', 140, 100), snk('C', 'C', 300, 100)],
  edges: [e('R', 'b1'), e('b1', 'C')],
  symbols: syms('G1'),
};

/** La entrada alimenta un ramal que muere; la salida cuelga de otro bloque aislado. */
export const INVALID_UNREACHABLE: Diagram = {
  version: 1,
  nodes: [
    src('R', 'R', 0, 100),
    blk('b1', 'G1', 140, 100),
    pick('p', 280, 100),
    blk('b2', 'G2', 140, 240),
    snk('C', 'C', 420, 240),
  ],
  edges: [e('R', 'b1'), e('b1', 'p'), e('b2', 'C')],
  symbols: syms('G1', 'G2'),
};

export const INVALID_SELF_LOOP: Diagram = {
  version: 1,
  nodes: [src('R', 'R', 0, 100), pick('p', 140, 100), blk('b1', 'G1', 280, 100), snk('C', 'C', 420, 100)],
  edges: [e('R', 'p'), e('p', 'b1'), e('b1', 'p'), e('p', 'C')],
  symbols: syms('G1'),
};

export const EXAMPLES: Example[] = [
  { id: 'T1', name: 'Serie', description: 'Dos bloques en cascada.', diagram: T1 },
  { id: 'T2', name: 'Paralelo', description: 'Dos ramas entre los mismos nodos.', diagram: T2 },
  { id: 'T3', name: 'Realimentación negativa', description: 'Lazo unitario negativo.', diagram: T3 },
  { id: 'T4', name: 'Realimentación positiva', description: 'Mismo lazo con signo +.', diagram: T4 },
  { id: 'T5', name: 'Lazos anidados', description: 'Lazo interno dentro del externo.', diagram: T5 },
  { id: 'T6', name: 'Lazos no adyacentes', description: 'Dos lazos en cascada sin nodos comunes.', diagram: T6 },
  { id: 'T7', name: 'Caso de examen', description: 'Paralelo, adelanto, lazos anidados y no adyacentes.', diagram: T7 },
];

export const clone = (d: Diagram): Diagram => JSON.parse(JSON.stringify(d)) as Diagram;
