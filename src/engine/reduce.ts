import type { Diagram, NodeId } from './types.ts';
import type { Sfg } from './sfg/types.ts';
import { edgeWeight } from './sfg/weight.ts';
import type { Ratio } from './polynomial/ratio.ts';
import { addRatio, cancel, closeLoop, equalsRatio, fromPoly, mulRatio } from './polynomial/ratio.ts';
import type { Polynomial } from './polynomial/polynomial.ts';
import { equals, isZeroPoly, one, toString as polyToString } from './polynomial/polynomial.ts';
import type { MasonResult } from './mason.ts';

/**
 * Reducción narrada de un diagrama, paso a paso.
 *
 * No es álgebra de bloques: esa se atasca en cuanto los lazos se entrelazan, y
 * entonces no habría nada que contar. Lo que se hace aquí es eliminación de
 * nodos sobre el grafo de flujo — Gauss sobre el grafo —, que termina siempre,
 * con cualquier diagrama. Lo que sí se conserva es el vocabulario: cuando el
 * patrón que toca coincide con una regla de libro se anuncia con su nombre,
 * así que un diagrama corriente produce exactamente la narración de siempre y
 * uno entrelazado produce una narración algo más larga en vez de un callejón.
 *
 * Mason sigue siendo la fuente de verdad: el resultado se contrasta con él
 * antes de darlo por bueno (`matchesMason`).
 */

const ORDINAL = ['primer', 'segundo', 'tercer', 'cuarto', 'quinto', 'sexto'];
const ORDINAL_F = ['primera', 'segunda', 'tercera', 'cuarta', 'quinta', 'sexta'];

/** Un nombre con su género, para que las contracciones salgan bien. */
export interface NodeName {
  noun: string;
  fem: boolean;
}

export interface Naming {
  nodes: Map<NodeId, NodeName>;
  /** Ganancia de cada bloque, para poder decir por dónde pasa un lazo. */
  gains: Map<NodeId, string>;
}

/**
 * Cómo se llama cada cosa en los pasos.
 *
 * Los ids internos (`pk1`, `s2`) no significan nada para quien está aprendiendo.
 * Se numera de izquierda a derecha, que es como se lee el diagrama: «el segundo
 * sumador» se localiza en el lienzo sin pensar, y además el panel lo resalta al
 * pasar el cursor.
 */
export function naming(d: Diagram): Naming {
  const nodes = new Map<NodeId, NodeName>();
  const gains = new Map<NodeId, string>();
  const ofKind = (kind: string) => d.nodes.filter((n) => n.kind === kind).sort((a, b) => a.pos.x - b.pos.x);

  for (const n of d.nodes) {
    if (n.kind === 'source') nodes.set(n.id, { noun: `entrada ${n.label}(s)`, fem: true });
    if (n.kind === 'sink') nodes.set(n.id, { noun: `salida ${n.label}(s)`, fem: true });
    if (n.kind === 'block') gains.set(n.id, n.gain.trim() || '1');
  }

  const sums = ofKind('sum');
  sums.forEach((n, i) => {
    const noun = sums.length === 1 ? 'sumador' : `${ORDINAL[i] ?? `${i + 1}.º`} sumador`;
    nodes.set(n.id, { noun, fem: false });
  });

  const taps = ofKind('pickoff');
  taps.forEach((n, i) => {
    const noun = taps.length === 1 ? 'bifurcación' : `${ORDINAL_F[i] ?? `${i + 1}.ª`} bifurcación`;
    nodes.set(n.id, { noun, fem: true });
  });

  return { nodes, gains };
}

const EMPTY_NAMING: Naming = { nodes: new Map(), gains: new Map() };

const nameOf = (nm: Naming, v: NodeId): NodeName => nm.nodes.get(v) ?? { noun: `nodo ${v}`, fem: false };

// Contracciones: sin esto salen cosas como «a el segundo sumador».
const el = (n: NodeName): string => `${n.fem ? 'la' : 'el'} ${n.noun}`;
const del = (n: NodeName): string => (n.fem ? `de la ${n.noun}` : `del ${n.noun}`);
const al = (n: NodeName): string => (n.fem ? `a la ${n.noun}` : `al ${n.noun}`);
const Cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export type RuleKind = 'parallel' | 'selfloop' | 'series' | 'eliminate';

/** Procedencia en el diagrama original, para resaltar en el lienzo. */
export interface Via {
  edges: string[];
  blocks: NodeId[];
}

export interface REdge {
  id: string;
  from: NodeId;
  to: NodeId;
  gain: Ratio;
  via: Via;
}

export interface RGraph {
  nodes: NodeId[];
  edges: REdge[];
  source: NodeId;
  sink: NodeId;
}

export interface ReductionStep {
  kind: RuleKind;
  /** Nombre de la regla, tal como se anuncia en el panel. */
  title: string;
  /** Qué se hizo y por qué se podía hacer. */
  detail: string;
  /** Nodo sobre el que actúa el paso, si lo hay. */
  at: NodeId | null;
  /** Elementos del diagrama original implicados, para resaltar. */
  via: Via;
  /** El grafo ya reducido, después de aplicar el paso. */
  graph: RGraph;
  /** La expresión que este paso introduce, cuando tiene una sola. */
  gain: Ratio | null;
  /**
   * Ganancia del lazo que se cierra, en los pasos que cierran uno. Se guarda
   * aparte porque `via` es deliberadamente un superconjunto — sirve para
   * resaltar en el lienzo — y nombrar el lazo a partir de él listaba bloques
   * que no estaban en el lazo.
   */
  loopGain: Ratio | null;
}

export interface Reduction {
  /** El grafo de partida, antes de tocar nada. */
  start: RGraph;
  steps: ReductionStep[];
  /** Ganancia de la única arista que queda, o null si no se llegó a una. */
  result: Ratio | null;
  /**
   * El resultado coincide con Mason por multiplicación cruzada. Si sale falso,
   * la narración no es de fiar y el panel se calla en vez de mentir.
   */
  matchesMason: boolean;
  /**
   * Δ = 0: no hay función de transferencia que contar. Va aparte de
   * `matchesMason` porque la comparación cruzada da cierto con dos ceros y el
   * motivo que hay que explicar es otro.
   */
  singular: boolean;
}

/** Tope de seguridad: sin él, un grafo patológico colgaría la pestaña. */
export const MAX_STEPS = 200;

const via = (...vs: Via[]): Via => ({
  edges: [...new Set(vs.flatMap((v) => v.edges))],
  blocks: [...new Set(vs.flatMap((v) => v.blocks))],
});

const cloneGraph = (g: RGraph): RGraph => ({
  nodes: [...g.nodes],
  edges: g.edges.map((e) => ({ ...e, via: { edges: [...e.via.edges], blocks: [...e.via.blocks] } })),
  source: g.source,
  sink: g.sink,
});

/** El SFG de partida, con las ganancias ya como funciones racionales. */
function initial(sfg: Sfg): RGraph {
  return {
    nodes: [...sfg.nodes],
    edges: sfg.edges.map((e, i) => ({
      // Prefijo distinto del de `eid`: si no, las aristas de partida chocan con
      // las generadas y el SVG acaba con dos claves de React iguales.
      id: `e${i}`,
      from: e.from,
      to: e.to,
      gain: fromPoly(edgeWeight(e)),
      via: { edges: [...e.via.edges], blocks: [...e.via.blocks] },
    })),
    source: sfg.source,
    sink: sfg.sink,
  };
}

const outOf = (g: RGraph, v: NodeId): REdge[] => g.edges.filter((e) => e.from === v && e.to !== v);
const inTo = (g: RGraph, v: NodeId): REdge[] => g.edges.filter((e) => e.to === v && e.from !== v);
const selfLoop = (g: RGraph, v: NodeId): REdge | undefined => g.edges.find((e) => e.from === v && e.to === v);

/** Nodos que se pueden eliminar: ni la entrada ni la salida. */
const interior = (g: RGraph): NodeId[] => g.nodes.filter((v) => v !== g.source && v !== g.sink);

/**
 * A quién le toca desaparecer.
 *
 * El criterio principal es el coste: cuántas aristas nuevas genera eliminarlo
 * (entradas × salidas). Con eso una cascada se deshace como cascada y el caso
 * feo solo aparece cuando el diagrama lo es.
 *
 * El desempate es lo que hace que la narración se parezca a la de un libro: a
 * igualdad de coste gana el nodo que al irse deja un autolazo, porque el paso
 * siguiente es entonces «cerrar el lazo». Sin este desempate el reductor tiende
 * a deshacer los sumadores primero y la historia sale del revés: correcta, pero
 * irreconocible.
 */
function pick(g: RGraph): NodeId | null {
  let best: NodeId | null = null;
  let bestKey: [number, number] = [Infinity, Infinity];

  for (const v of interior(g)) {
    const ins = inTo(g, v);
    const outs = outOf(g, v);
    const froms = new Set(ins.map((e) => e.from));
    const makesLoop = outs.some((e) => froms.has(e.to));
    const key: [number, number] = [ins.length * outs.length, makesLoop ? 0 : 1];
    if (key[0] < bestKey[0] || (key[0] === bestKey[0] && key[1] < bestKey[1])) {
      best = v;
      bestKey = key;
    }
  }

  return best;
}

let counter = 0;
const eid = (): string => `r${counter++}`;

/**
 * Los denominadores que la propia reducción va creando. Son exactamente los
 * factores que luego reaparecen arriba y hay que cancelar; guardarlos por su
 * forma normal evita probar el mismo dos veces.
 */
class Candidates {
  private readonly seen = new Map<string, Polynomial>();

  add(p: Polynomial): void {
    if (isZeroPoly(p) || equals(p, one())) return;
    const key = polyToString(p);
    if (!this.seen.has(key)) this.seen.set(key, p);
  }

  /** Deja la ganancia en la forma más corta que se pueda con lo conocido. */
  tidy(r: Ratio): Ratio {
    const out = cancel(r, [...this.seen.values()]);
    this.add(out.den);
    return out;
  }
}

/** Une las aristas que van del mismo nodo al mismo nodo: ramas en paralelo. */
function mergeParallel(g: RGraph, cand: Candidates): { edges: REdge[]; merged: REdge[] } | null {
  for (let i = 0; i < g.edges.length; i++) {
    const a = g.edges[i]!;
    const same = g.edges.filter((e) => e.from === a.from && e.to === a.to);
    if (same.length < 2) continue;
    let sum = same[0]!.gain;
    for (const e of same.slice(1)) sum = addRatio(sum, e.gain);
    sum = cand.tidy(sum);
    const fused: REdge = {
      id: eid(),
      from: a.from,
      to: a.to,
      gain: sum,
      via: via(...same.map((e) => e.via)),
    };
    const rest = g.edges.filter((e) => !same.includes(e));
    return { edges: [...rest, fused], merged: same };
  }
  return null;
}

/**
 * Elimina un nodo: cada entrada se enchufa con cada salida y el nodo se va.
 * Si el nodo tiene autolazo, primero se cierra sobre sus entradas — es el
 * `1/(1 - L)` de toda la vida.
 */
function eliminateNode(
  g: RGraph,
  v: NodeId,
  loop: REdge | undefined,
  cand: Candidates,
): { graph: RGraph; fresh: REdge[] } {
  const ins = inTo(g, v);
  const outs = outOf(g, v);
  const fresh: REdge[] = [];

  for (const a of ins) {
    const entering = loop ? cand.tidy(closeLoop(a.gain, loop.gain)) : a.gain;
    for (const b of outs) {
      fresh.push({
        id: eid(),
        from: a.from,
        to: b.to,
        gain: cand.tidy(mulRatio(entering, b.gain)),
        via: loop ? via(a.via, b.via, loop.via) : via(a.via, b.via),
      });
    }
  }

  return {
    graph: {
      nodes: g.nodes.filter((n) => n !== v),
      edges: [...g.edges.filter((e) => e.from !== v && e.to !== v), ...fresh],
      source: g.source,
      sink: g.sink,
    },
    fresh,
  };
}

/** Cómo se cuenta la eliminación de un nodo, según la forma que tenga. */
function describe(
  g: RGraph,
  v: NodeId,
  loop: REdge | undefined,
  nm: Naming,
  warnOnce: { said: boolean },
): { kind: RuleKind; title: string; detail: string } {
  const ins = inTo(g, v).length;
  const outs = outOf(g, v).length;
  const name = nameOf(nm, v);

  if (loop) {
    // El error clásico es contar solo el bloque de la rama de vuelta y olvidar
    // los de ida. La ganancia exacta la enseña el panel; aquí se avisa — una sola
    // vez, porque repetido en cada lazo deja de leerse.
    let trap = '';
    if (loop.via.blocks.length > 1 && !warnOnce.said) {
      warnOnce.said = true;
      trap =
        ' Ojo a la ganancia del lazo: es el producto de todo lo que recorre, también los ' +
        'bloques de ida, no solo el de la rama de vuelta. Ese es el fallo típico.';
    }

    if (ins <= 1 && outs <= 1) {
      return {
        kind: 'selfloop',
        title: 'Lazo cerrado',
        detail:
          `La señal que sale ${del(name)} termina volviendo a entrar por la realimentación: ` +
          `eso es un lazo. Se cierra dividiendo la rama entre 1 menos la ganancia del lazo. ` +
          `El signo del sumador ya viaja dentro de esa ganancia, y por eso una realimentación ` +
          `negativa deja abajo un 1 + GH, sumando.${trap}`,
      };
    }

    return {
      kind: 'selfloop',
      title: 'Lazo cerrado, y el punto se va',
      detail:
        `${Cap(el(name))} cierra un lazo sobre sí mismo y además reparte varias ramas. ` +
        `Primero se cierra el lazo — dividir entre 1 menos su ganancia — y luego se enlaza ` +
        `cada entrada con cada salida, porque el punto ya no hace falta.${trap}`,
    };
  }

  if (ins === 1 && outs === 1) {
    return {
      kind: 'series',
      title: 'Cascada',
      detail:
        `Por ${el(name)} entra una sola señal y sale una sola señal, y de ahí no se toma nada ` +
        `para otra rama. Cuando eso pasa — y solo cuando pasa — las dos ganancias seguidas se ` +
        `multiplican en una.`,
    };
  }

  if (outs === 1) {
    return {
      kind: 'eliminate',
      title: 'El punto de suma se disuelve',
      detail:
        `${Cap(el(name))} junta ${ins} ramas y de él sale una sola. Quitarlo es prolongar cada ` +
        `rama que llegaba hasta donde iba esa salida: la suma sigue ocurriendo, solo que ahora ` +
        `está repartida entre las ${ins} ramas nuevas.`,
    };
  }

  if (ins === 1) {
    return {
      kind: 'eliminate',
      title: 'La bifurcación se disuelve',
      detail:
        `${Cap(el(name))} copia la misma señal hacia ${outs} sitios. Quitarla es llevar esa ` +
        `señal directamente a cada destino, arrastrando en cada rama la ganancia con la que ` +
        `había llegado.`,
    };
  }

  return {
    kind: 'eliminate',
    title: 'Se reparte y se quita',
    detail:
      `${Cap(al(name))} llegan ${ins} ramas y salen ${outs}. Al quitarlo, cada entrada se conecta ` +
      `directa con cada salida: ${ins * outs} rutas, cada una con el producto de las dos ganancias ` +
      `que atraviesa. Este paso es el que permite seguir cuando el diagrama ya no se deja plegar ` +
      `con cascadas y lazos.`,
  };
}

/** Reduce el grafo hasta dejar una sola arista, narrando cada paso. */
export function reduce(sfg: Sfg, mason: MasonResult, nm: Naming = EMPTY_NAMING): Reduction {
  counter = 0;
  const cand = new Candidates();
  const warnOnce = { said: false };
  const start = initial(sfg);
  let g = cloneGraph(start);
  const steps: ReductionStep[] = [];

  while (steps.length < MAX_STEPS) {
    // Primero lo barato: unir ramas paralelas mantiene el grafo pequeño.
    const par = mergeParallel(g, cand);
    if (par) {
      const fused = par.edges[par.edges.length - 1]!;
      g = { ...g, edges: par.edges };
      steps.push({
        kind: 'parallel',
        title: 'Ramas en paralelo',
        detail:
          `Hay ${par.merged.length} ramas que salen del mismo punto y llegan al mismo punto. ` +
          `La señal se va por las dos a la vez y se vuelve a juntar, así que las ganancias ` +
          `se suman en una sola rama.`,
        at: null,
        via: via(...par.merged.map((e) => e.via)),
        graph: cloneGraph(g),
        gain: fused.gain,
        loopGain: null,
      });
      continue;
    }

    const v = pick(g);
    if (v === null) break;

    const loop = selfLoop(g, v);
    const how = describe(g, v, loop, nm, warnOnce);
    const touched = via(
      ...inTo(g, v).map((e) => e.via),
      ...outOf(g, v).map((e) => e.via),
      ...(loop ? [loop.via] : []),
    );

    const done = eliminateNode(g, v, loop, cand);
    g = done.graph;

    steps.push({
      ...how,
      at: v,
      via: touched,
      graph: cloneGraph(g),
      // Solo hay una expresión que enseñar si el paso dejó una única rama nueva.
      gain: done.fresh.length === 1 ? done.fresh[0]!.gain : null,
      loopGain: loop ? loop.gain : null,
    });
  }

  // Puede quedar más de una arista source -> sink: se suman como paralelas.
  const direct = g.edges.filter((e) => e.from === g.source && e.to === g.sink);
  let result: Ratio | null = null;
  for (const e of direct) result = result === null ? e.gain : addRatio(result, e.gain);
  if (result) result = cand.tidy(result);

  const singular = isZeroPoly(mason.denominator);
  const target: Ratio = { num: mason.numerator, den: mason.denominator };
  const matchesMason = !singular && result !== null && equalsRatio(result, target);

  return { start, steps, result, matchesMason, singular };
}
