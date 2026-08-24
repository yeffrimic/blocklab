import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CSSProperties } from 'react';
import type { DiagramNode, Side, SumPort } from '../../engine/types.ts';

export interface NodeData extends Record<string, unknown> {
  node: DiagramNode;
  /** Marcado por una validación con error. */
  bad: boolean;
  /** Resaltado por el lazo o camino bajo el cursor en el panel de resultado. */
  hot: boolean;
}

const cls = (d: NodeData, base: string, selected?: boolean) =>
  [base, d.bad && 'bad', d.hot && 'hot', selected && 'sel'].filter(Boolean).join(' ');

/** Subíndices tipográficos: `G1` se dibuja como G₁. */
function Gain({ text }: { text: string }) {
  const m = /^([A-Za-z]+)(\d+)$/.exec(text.trim());
  if (!m) return <>{text || '—'}</>;
  return (
    <>
      {m[1]}
      <sub>{m[2]}</sub>
    </>
  );
}

/**
 * Entradas: una por lado, sin pintar y solo para soltar.
 *
 * Los puntos que se ven en un nodo son sus salidas, así que tirar de cualquiera
 * de ellos empieza siempre una flecha que sale de ahí. Las entradas comparten
 * posición con esas salidas pero van debajo y con `isConnectableStart` en falso:
 * no roban el arrastre, y al soltar cerca del nodo `connectionRadius` engancha
 * la que quede más cerca, que es la del lado por el que llega la flecha.
 */
function Inputs() {
  return (
    <>
      <Handle type="target" position={Position.Left} id="in" className="mirror" isConnectableStart={false} />
      <Handle type="target" position={Position.Right} id="in-r" className="mirror" isConnectableStart={false} />
    </>
  );
}

/** Salidas: los dos puntos visibles del nodo, uno por lado. */
function Outputs() {
  return (
    <>
      <Handle type="source" position={Position.Left} id="out-l" />
      <Handle type="source" position={Position.Right} id="out" />
    </>
  );
}

export function BlockNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const node = d.node as Extract<DiagramNode, { kind: 'block' }>;
  return (
    <div className={cls(d, 'n-block', selected)}>
      <Inputs />
      <span className="gain">
        <Gain text={node.gain} />
      </span>
      <Outputs />
    </div>
  );
}

export function SourceNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const node = d.node as Extract<DiagramNode, { kind: 'source' }>;
  return (
    <div className={cls(d, 'n-terminal n-source', selected)}>
      <span>{node.label}(s)</span>
      <Outputs />
    </div>
  );
}

export function SinkNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const node = d.node as Extract<DiagramNode, { kind: 'sink' }>;
  return (
    // La salida solo recibe: aquí las entradas sí se pintan, no compiten con nada.
    <div className={cls(d, 'n-terminal n-sink', selected)}>
      <Handle type="target" position={Position.Left} id="in" isConnectableStart={false} />
      <Handle type="target" position={Position.Right} id="in-r" isConnectableStart={false} />
      <span>{node.label}(s)</span>
    </div>
  );
}

export function PickoffNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  return (
    <div
      className={cls(d, 'n-pickoff', selected)}
      title={
        'Nodo de bifurcación: copia la señal, ganancia 1.\n' +
        'Arrastra el punto para moverlo; tira de un conector lateral para sacar una flecha.'
      }
    >
      <Inputs />
      {/* El punto es lo único que se ve en reposo; el resto de la caja es margen para arrastrar. */}
      <span className="dot" />
      <Outputs />
    </div>
  );
}

interface PortSlot {
  position: Position;
  style: CSSProperties;
  sign: CSSProperties;
}

/**
 * Reparto de los puertos alrededor del círculo del sumador. Entran por el lado
 * opuesto a la salida, arriba y abajo se quedan donde están: al espejar el
 * sumador, la realimentación sigue llegando por el mismo sitio.
 */
function portSlots(facing: Side): PortSlot[] {
  const side = facing === 'left' ? Position.Right : Position.Left;
  // El signo va justo fuera del círculo, que mide 34px.
  const signX = facing === 'left' ? 52 : -18;
  return [
    { position: side, style: { top: '50%' }, sign: { left: signX, top: '50%' } },
    { position: Position.Bottom, style: { left: '50%' }, sign: { left: '50%', bottom: -20 } },
    { position: Position.Top, style: { left: '50%' }, sign: { left: '50%', top: -20 } },
    { position: side, style: { top: '12%' }, sign: { left: signX, top: '12%' } },
    { position: side, style: { top: '88%' }, sign: { left: signX, top: '88%' } },
  ];
}

export function SumNode({ data, selected }: NodeProps) {
  const d = data as NodeData;
  const node = d.node as Extract<DiagramNode, { kind: 'sum' }>;
  const facing: Side = node.facing ?? 'right';
  const slots = portSlots(facing);
  // La salida se pinta del lado al que mira; la del lado contrario queda de
  // contraconector, sin pintar y bajo los puertos, para que una arista trazada
  // antes de espejar el sumador siga entrando por donde toca.
  const out = facing === 'left' ? { position: Position.Left, id: 'out-l' } : { position: Position.Right, id: 'out' };
  const back = facing === 'left' ? { position: Position.Right, id: 'out' } : { position: Position.Left, id: 'out-l' };
  return (
    <div className={cls(d, 'n-sum', selected)}>
      <span className="cross">⊕</span>
      <Handle type="source" position={back.position} id={back.id} className="mirror" />
      {/* Los puertos son las entradas del sumador: se pintan con su signo y solo
          admiten que se suelte en ellos, porque el signo depende de cuál se elija. */}
      {node.ports.map((p: SumPort, i: number) => {
        const slot = slots[i % slots.length]!;
        return (
          <span key={p.id}>
            <Handle
              type="target"
              position={slot.position}
              id={p.id}
              style={slot.style}
              className={p.sign === 1 ? 'port-plus' : 'port-minus'}
              isConnectableStart={false}
            />
            <span className="port-sign" style={slot.sign}>
              {p.sign === 1 ? '+' : '−'}
            </span>
          </span>
        );
      })}
      <Handle type="source" position={out.position} id={out.id} />
    </div>
  );
}

export const nodeTypes = {
  block: BlockNode,
  source: SourceNode,
  sink: SinkNode,
  pickoff: PickoffNode,
  sum: SumNode,
};
