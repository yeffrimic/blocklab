import { create } from 'zustand';
import type { Diagram, DiagramNode, NodeId, PortId, Side, Sign, XY } from '../engine/types.ts';
import { clone, T3 } from '../engine/examples.ts';
import { gainSymbols } from '../engine/polynomial/parse.ts';

const STORAGE_KEY = 'blocklab:diagram:v1';

export interface Highlight {
  nodes: Set<NodeId>;
  edges: Set<string>;
}

interface State {
  diagram: Diagram;
  selected: NodeId | null;
  /** Elementos resaltados al pasar el cursor sobre un lazo o camino del panel. */
  highlight: Highlight | null;

  select: (id: NodeId | null) => void;
  setHighlight: (h: Highlight | null) => void;

  addNode: (kind: DiagramNode['kind'], pos: XY) => NodeId;
  /** Mueve sin escribir en disco: se llama en cada cuadro del arrastre. */
  moveNode: (id: NodeId, pos: XY) => void;
  /** Confirma en el autoguardado lo que quedó tras un arrastre. */
  commit: () => void;
  removeNodes: (ids: NodeId[]) => void;
  setGain: (id: NodeId, gain: string) => void;
  setLabel: (id: NodeId, label: string) => void;

  addPort: (id: NodeId, sign: Sign) => void;
  removePort: (id: NodeId, port: PortId) => void;
  togglePort: (id: NodeId, port: PortId) => void;
  /** Lado de salida del sumador; las entradas se van al contrario. */
  setSumFacing: (id: NodeId, facing: Side) => void;

  connect: (from: NodeId, to: NodeId, toPort?: PortId, sides?: { from?: Side; to?: Side }) => void;
  removeEdges: (ids: string[]) => void;

  declareSymbol: (name: string) => void;
  removeSymbol: (name: string) => void;
  syncSymbols: () => void;

  load: (d: Diagram) => void;
  reset: () => void;
}

let counter = 0;
const nid = (kind: string): string => `${kind[0]}${Date.now().toString(36).slice(-4)}${(counter++).toString(36)}`;

function initial(): Diagram {
  const fromHash = readHash();
  if (fromHash) return fromHash;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Diagram;
  } catch {
    /* almacenamiento no disponible: se empieza con el ejemplo */
  }
  return clone(T3);
}

function readHash(): Diagram | null {
  try {
    const h = location.hash.replace(/^#d=/, '');
    if (!h || h === location.hash) return null;
    return JSON.parse(decodeURIComponent(escape(atob(h)))) as Diagram;
  } catch {
    return null;
  }
}

/** Comparte el diagrama en el fragmento de la URL: sin backend. */
export function shareUrl(d: Diagram): string {
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify(d))));
  return `${location.origin}${location.pathname}#d=${payload}`;
}

const persist = (d: Diagram) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    /* modo privado o cuota llena: el autoguardado es opcional */
  }
};

/** Toda mutación pasa por aquí para no olvidar el autoguardado. */
const edit = (set: (fn: (s: State) => Partial<State>) => void) =>
  (mutate: (d: Diagram) => void) =>
    set((s) => {
      const d = clone(s.diagram);
      mutate(d);
      persist(d);
      return { diagram: d };
    });

export const useDiagram = create<State>((set, get) => {
  const apply = edit(set);

  return {
    diagram: initial(),
    selected: null,
    highlight: null,

    select: (id) => set({ selected: id }),
    setHighlight: (highlight) => set({ highlight }),

    addNode: (kind, pos) => {
      const id = nid(kind);
      apply((d) => {
        switch (kind) {
          case 'source':
            d.nodes.push({ id, kind, label: 'R', pos });
            break;
          case 'sink':
            d.nodes.push({ id, kind, label: 'C', pos });
            break;
          case 'block':
            d.nodes.push({ id, kind, gain: '', pos });
            break;
          case 'sum':
            d.nodes.push({ id, kind, ports: [{ id: 'p1', sign: 1 }, { id: 'p2', sign: -1 }], pos });
            break;
          case 'pickoff':
            d.nodes.push({ id, kind, pos });
            break;
        }
      });
      set({ selected: id });
      return id;
    },

    moveNode: (id, pos) =>
      set((s) => {
        const d = clone(s.diagram);
        const n = d.nodes.find((x) => x.id === id);
        if (n) n.pos = pos;
        return { diagram: d };
      }),

    commit: () => persist(get().diagram),

    removeNodes: (ids) => {
      const gone = new Set(ids);
      apply((d) => {
        d.nodes = d.nodes.filter((n) => !gone.has(n.id));
        d.edges = d.edges.filter((e) => !gone.has(e.from) && !gone.has(e.to));
      });
      if (get().selected && gone.has(get().selected!)) set({ selected: null });
    },

    setGain: (id, gain) =>
      apply((d) => {
        const n = d.nodes.find((x) => x.id === id);
        if (n?.kind === 'block') n.gain = gain;
      }),

    setLabel: (id, label) =>
      apply((d) => {
        const n = d.nodes.find((x) => x.id === id);
        if (n?.kind === 'source' || n?.kind === 'sink') n.label = label;
      }),

    addPort: (id, sign) =>
      apply((d) => {
        const n = d.nodes.find((x) => x.id === id);
        if (n?.kind !== 'sum') return;
        let k = n.ports.length + 1;
        while (n.ports.some((p) => p.id === `p${k}`)) k++;
        n.ports.push({ id: `p${k}`, sign });
      }),

    removePort: (id, port) =>
      apply((d) => {
        const n = d.nodes.find((x) => x.id === id);
        if (n?.kind !== 'sum') return;
        n.ports = n.ports.filter((p) => p.id !== port);
        d.edges = d.edges.filter((e) => !(e.to === id && e.toPort === port));
      }),

    togglePort: (id, port) =>
      apply((d) => {
        const n = d.nodes.find((x) => x.id === id);
        if (n?.kind !== 'sum') return;
        const p = n.ports.find((q) => q.id === port);
        if (p) p.sign = p.sign === 1 ? -1 : 1;
      }),

    setSumFacing: (id, facing) =>
      apply((d) => {
        const n = d.nodes.find((x) => x.id === id);
        if (n?.kind !== 'sum') return;
        if (facing === 'right') delete n.facing;
        else n.facing = facing;
      }),

    connect: (from, to, toPort, sides) =>
      apply((d) => {
        const id = `e${Date.now().toString(36)}${(counter++).toString(36)}`;
        const exists = d.edges.some((e) => e.from === from && e.to === to && e.toPort === toPort);
        if (exists) return;
        d.edges.push({
          id,
          from,
          to,
          ...(toPort ? { toPort } : {}),
          ...(sides?.from ? { fromSide: sides.from } : {}),
          ...(sides?.to ? { toSide: sides.to } : {}),
        });
      }),

    removeEdges: (ids) => {
      const gone = new Set(ids);
      apply((d) => {
        d.edges = d.edges.filter((e) => !gone.has(e.id));
      });
    },

    declareSymbol: (name) =>
      apply((d) => {
        if (!d.symbols.some((s) => s.name === name)) d.symbols.push({ name });
      }),

    removeSymbol: (name) =>
      apply((d) => {
        d.symbols = d.symbols.filter((s) => s.name !== name);
      }),

    /** Declara de golpe todos los símbolos que aparecen en las ganancias y aún faltan. */
    syncSymbols: () =>
      apply((d) => {
        const used = new Set<string>();
        for (const n of d.nodes) if (n.kind === 'block') for (const s of gainSymbols(n.gain)) used.add(s);
        for (const s of used) if (!d.symbols.some((x) => x.name === s)) d.symbols.push({ name: s });
      }),

    load: (d) => {
      const copy = clone(d);
      persist(copy);
      set({ diagram: copy, selected: null, highlight: null });
    },

    reset: () => {
      const empty: Diagram = { version: 1, nodes: [], edges: [], symbols: [] };
      persist(empty);
      set({ diagram: empty, selected: null, highlight: null });
    },
  };
});
