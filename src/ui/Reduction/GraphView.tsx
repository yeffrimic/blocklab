import type { RGraph } from '../../engine/reduce.ts';
import { ratioToString } from '../../engine/polynomial/ratio.ts';

/**
 * El grafo reducido, como diagrama de arcos.
 *
 * No se intenta redibujar un diagrama de bloques: la reducción atraviesa estados
 * que ya no son un diagrama de bloques — un nodo con autolazo no tiene dibujo de
 * libro — y un trazado automático que a veces sale y a veces no sería peor que
 * ninguno. Los nodos van en fila, las ramas hacia delante por arriba y las de
 * vuelta por abajo. Eso vale para cualquier topología y se lee de un vistazo.
 */

const W = 300;
const PAD = 22;
/** Separación entre ramas apiladas entre el mismo par de nodos. */
const TIER = 14;

/** Las expresiones crecen mucho; en el arco solo cabe una etiqueta corta. */
function short(text: string, max = 18): string {
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

export function GraphView({ graph, dim = false }: { graph: RGraph; dim?: boolean }) {
  const order = graph.nodes;
  const n = order.length;
  const step = n > 1 ? (W - 2 * PAD) / (n - 1) : 0;
  const pos = new Map(order.map((id, i) => [id, PAD + i * step]));
  const x = (id: string) => pos.get(id) ?? PAD;

  // Varias ramas entre el mismo par se separan en altura para que no se solapen.
  const seen = new Map<string, number>();
  const tier = (from: string, to: string): number => {
    const k = `${from}>${to}`;
    const t = seen.get(k) ?? 0;
    seen.set(k, t + 1);
    return t;
  };

  // El lienzo se dimensiona según lo que hay que dibujar: con dos ramas de vuelta
  // apiladas, una altura fija recortaba la de más abajo.
  const stack = new Map<string, number>();
  let up = 0;
  let down = 0;
  for (const e of graph.edges) {
    const k = `${e.from}>${e.to}`;
    const t = stack.get(k) ?? 0;
    stack.set(k, t + 1);
    if (e.from === e.to) up = Math.max(up, 34 + t * 12);
    else if (x(e.to) < x(e.from)) down = Math.max(down, 44 + t * TIER);
    else up = Math.max(up, 34 + t * TIER);
  }

  const BASE = up + 14;
  const H = BASE + down + 22;

  return (
    <svg className={`graph-view${dim ? ' dim' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label={`Grafo con ${n} nodos y ${graph.edges.length} ramas`}>
      <defs>
        <marker id="gv-arrow" viewBox="0 0 10 10" refX="9" refY="5"
                markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill="context-stroke" />
        </marker>
      </defs>

      {graph.edges.map((e) => {
        const x1 = x(e.from);
        const x2 = x(e.to);
        const label = short(ratioToString(e.gain));
        const t = tier(e.from, e.to);

        if (e.from === e.to) {
          const r = 13 + t * 6;
          return (
            <g key={e.id} className="gv-edge loop">
              <path d={`M ${x1 - 5} ${BASE - 5} A ${r} ${r} 0 1 1 ${x1 + 5} ${BASE - 5}`}
                    markerEnd="url(#gv-arrow)" />
              <text x={x1} y={BASE - 12 - 2 * r} textAnchor="middle">
                {label}
                <title>{ratioToString(e.gain)}</title>
              </text>
            </g>
          );
        }

        const back = x2 < x1;
        const lift = (back ? 1 : -1) * (26 + t * TIER);
        const mid = (x1 + x2) / 2;
        return (
          <g key={e.id} className={`gv-edge${back ? ' back' : ''}`}>
            <path d={`M ${x1} ${BASE} Q ${mid} ${BASE + lift * 1.6} ${x2} ${BASE}`}
                  markerEnd="url(#gv-arrow)" />
            <text x={mid} y={BASE + lift * 0.95 + (back ? 11 : -3)} textAnchor="middle">
              {label}
              <title>{ratioToString(e.gain)}</title>
            </text>
          </g>
        );
      })}

      {order.map((id) => (
        <g key={id} className={`gv-node${id === graph.source || id === graph.sink ? ' end' : ''}`}>
          <circle cx={x(id)} cy={BASE} r={4.5} />
          <text x={x(id)} y={BASE + 17} textAnchor="middle">{id}</text>
        </g>
      ))}
    </svg>
  );
}
