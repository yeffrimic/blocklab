import type { NodeId, Sign } from '../types.ts';
import type { Polynomial } from '../polynomial/polynomial.ts';

export interface SfgEdge {
  id: string;
  from: NodeId;
  to: NodeId;
  /** Expresiones de ganancia a multiplicar; `[]` significa ganancia 1. */
  gain: string[];
  sign: Sign;
  /** Procedencia en el diagrama original, para resaltar en el lienzo. */
  via: { edges: string[]; blocks: NodeId[] };
}

export interface Sfg {
  /** Nodos del SFG: source, sink, sumadores y bifurcaciones. Los bloques ya no son nodos. */
  nodes: NodeId[];
  edges: SfgEdge[];
  source: NodeId;
  sink: NodeId;
  /** índice de nodo -> bit, para las máscaras de adyacencia. */
  index: Map<NodeId, number>;
}

/** Producto simbólico de una lista de aristas del SFG, con sus signos. */
export interface WeightedWalk {
  /** Nodos visitados, en orden. */
  nodes: NodeId[];
  edges: SfgEdge[];
  gain: Polynomial;
  /** Bitmask de nodos tocados. */
  mask: bigint;
}
