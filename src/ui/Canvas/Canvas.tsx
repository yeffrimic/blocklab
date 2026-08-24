import { useCallback, useMemo } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDiagram } from '../../store/useDiagram.ts';
import type { Issue } from '../../engine/validate.ts';
import type { Side } from '../../engine/types.ts';
import { nodeTypes, type NodeData } from './nodes.tsx';

interface Props {
  issues: Issue[];
}

/**
 * Cada nodo lleva un conector por lado: `out`/`in` a la derecha y a la izquierda
 * son los del flujo normal, `out-l`/`in-r` los del sentido contrario. Los puertos
 * del sumador no entran aquí: su id es el del puerto y su lado lo fija la ranura.
 */
const SOURCE_HANDLE: Record<Side, string> = { left: 'out-l', right: 'out' };
const TARGET_HANDLE: Record<Side, string> = { left: 'in', right: 'in-r' };

const sourceSide = (handle: string | null | undefined): Side | undefined =>
  handle === 'out-l' ? 'left' : handle === 'out' ? 'right' : undefined;

const targetSide = (handle: string | null | undefined): Side | undefined =>
  handle === 'in-r' ? 'right' : handle === 'in' ? 'left' : undefined;

export function Canvas({ issues }: Props) {
  const diagram = useDiagram((s) => s.diagram);
  const selected = useDiagram((s) => s.selected);
  const highlight = useDiagram((s) => s.highlight);
  const { select, moveNode, commit, removeNodes, removeEdges, connect } = useDiagram.getState();

  const bad = useMemo(() => {
    const nodes = new Set<string>();
    const edges = new Set<string>();
    for (const i of issues) {
      if (i.level !== 'error') continue;
      for (const n of i.nodes) nodes.add(n);
      for (const e of i.edges) edges.add(e);
    }
    return { nodes, edges };
  }, [issues]);

  const rfNodes = useMemo<Node<NodeData>[]>(
    () =>
      diagram.nodes.map((n) => ({
        id: n.id,
        type: n.kind,
        position: n.pos,
        selected: n.id === selected,
        data: {
          node: n,
          bad: bad.nodes.has(n.id),
          hot: highlight?.nodes.has(n.id) ?? false,
        },
      })),
    [diagram.nodes, selected, bad, highlight],
  );

  const byId = useMemo(() => new Map(diagram.nodes.map((n) => [n.id, n])), [diagram.nodes]);

  const rfEdges = useMemo<Edge[]>(
    () =>
      diagram.edges.map((e) => {
        const hot = highlight?.edges.has(e.id) ?? false;
        const from = byId.get(e.from);
        const to = byId.get(e.to);
        // Manda el conector del que se tiró al trazarla. Solo si la arista no lo
        // trae — diagramas antiguos, plantillas — se deduce de las posiciones: una
        // arista que retrocede es realimentación y sale por la izquierda del origen
        // para entrar por la derecha del destino, como se dibuja a mano.
        const backwards = !!from && !!to && from.pos.x > to.pos.x;
        const fromSide: Side = e.fromSide ?? (backwards ? 'left' : 'right');
        const toSide: Side = e.toSide ?? (backwards ? 'right' : 'left');
        return {
          id: e.id,
          source: e.from,
          target: e.to,
          sourceHandle: SOURCE_HANDLE[fromSide],
          // En un sumador manda el puerto, que ya trae su propia ranura y su signo.
          targetHandle: to?.kind === 'sum' ? (e.toPort ?? 'in') : TARGET_HANDLE[toSide],
          type: 'smoothstep',
          className: [bad.edges.has(e.id) && 'bad', hot && 'hot'].filter(Boolean).join(' '),
          markerEnd: { type: 'arrowclosed' as const, width: 14, height: 14 },
        };
      }),
    [diagram.edges, byId, bad, highlight],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      for (const c of changes) {
        if (c.type === 'position' && c.position) moveNode(c.id, c.position);
        if (c.type === 'position' && c.dragging === false) commit();
        if (c.type === 'remove') removeNodes([c.id]);
        if (c.type === 'select' && c.selected) select(c.id);
      }
    },
    [moveNode, commit, removeNodes, select],
  );

  const onConnect = useCallback<OnConnect>(
    (c: Connection) => {
      if (!c.source || !c.target) return;
      const target = diagram.nodes.find((n) => n.id === c.target);
      const isSum = target?.kind === 'sum';
      const toPort = isSum ? (c.targetHandle ?? undefined) : undefined;
      // El lado del que se tiró se guarda con la arista, para que la flecha salga
      // justo del conector elegido en vez de recolocarse sola.
      connect(c.source, c.target, toPort, {
        from: sourceSide(c.sourceHandle),
        to: isSum ? undefined : targetSide(c.targetHandle),
      });
    },
    [connect, diagram.nodes],
  );

  return (
    <div className="canvas">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={(changes) => removeEdges(changes.flatMap((c) => (c.type === 'remove' ? [c.id] : [])))}
        onConnect={onConnect}
        onPaneClick={() => select(null)}
        onEdgeClick={(_, e) => removeEdges([e.id])}
        proOptions={{ hideAttribution: true }}
        // Radio generoso: la conexión se engancha al conector más cercano en vez de
        // exigir soltar justo encima, que en la bifurcación son 9 píxeles.
        connectionRadius={30}
        fitView
        minZoom={0.2}
        maxZoom={2.5}
        deleteKeyCode={['Delete', 'Backspace']}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#d6d2c4" />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeColor="#c9c3b2" maskColor="rgba(250,248,243,.7)" />
      </ReactFlow>
    </div>
  );
}
