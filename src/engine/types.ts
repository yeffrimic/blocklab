export type NodeId = string;
export type PortId = string;
export type Sign = 1 | -1;

export interface XY {
  x: number;
  y: number;
}

export interface SumPort {
  id: PortId;
  sign: Sign;
}

export type DiagramNode =
  | { id: NodeId; kind: 'source'; label: string; pos: XY }
  | { id: NodeId; kind: 'sink'; label: string; pos: XY }
  | { id: NodeId; kind: 'block'; gain: string; pos: XY }
  /**
   * `facing` es el lado por el que sale la señal; las entradas se reparten por
   * el contrario. Un sumador de una rama que va de derecha a izquierda se dibuja
   * espejado. Por omisión, `'right'`. Solo presentación: el SFG no lo mira.
   */
  | { id: NodeId; kind: 'sum'; ports: SumPort[]; facing?: Side; pos: XY }
  | { id: NodeId; kind: 'pickoff'; pos: XY };

/** Lado del nodo por el que la arista sale o entra. Solo presentación. */
export type Side = 'left' | 'right';

export interface DiagramEdge {
  id: string;
  from: NodeId;
  to: NodeId;
  /** Obligatorio si `to` es un sumador: el signo vive en el puerto, nunca en la arista. */
  toPort?: PortId;
  /**
   * Conector elegido al trazar la arista. Si falta, el lienzo lo deduce de las
   * posiciones. No afecta al SFG: la señal va de `from` a `to` salga por donde salga.
   */
  fromSide?: Side;
  toSide?: Side;
  waypoints?: XY[];
}

export interface SymbolDef {
  name: string;
  /** Fase 2: coeficientes en `s`, orden descendente. */
  numeric?: { num: number[]; den: number[] };
}

export interface Diagram {
  version: 1;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  symbols: SymbolDef[];
}

export type NodeKind = DiagramNode['kind'];

export const emptyDiagram = (): Diagram => ({ version: 1, nodes: [], edges: [], symbols: [] });

export const nodeById = (d: Diagram, id: NodeId): DiagramNode | undefined =>
  d.nodes.find((n) => n.id === id);
