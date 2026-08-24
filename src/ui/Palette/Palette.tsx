import { useRef } from 'react';
import type { Diagram, DiagramNode } from '../../engine/types.ts';
import { EXAMPLES } from '../../engine/examples.ts';
import { shareUrl, useDiagram } from '../../store/useDiagram.ts';

export const SHORTCUTS: { key: string; kind: DiagramNode['kind']; label: string }[] = [
  { key: 'b', kind: 'block', label: 'Bloque' },
  { key: 's', kind: 'sum', label: 'Sumador' },
  { key: 'n', kind: 'pickoff', label: 'Bifurcación' },
  { key: 'e', kind: 'source', label: 'Entrada' },
  { key: 'c', kind: 'sink', label: 'Salida' },
];

/** Coloca el elemento nuevo en una diagonal libre para que no se solapen. */
export function nextPosition(d: Diagram) {
  const n = d.nodes.length;
  return { x: 80 + (n % 6) * 130, y: 80 + Math.floor(n / 6) * 110 };
}

export function Palette() {
  const diagram = useDiagram((s) => s.diagram);
  const { addNode, load, reset } = useDiagram.getState();
  const fileInput = useRef<HTMLInputElement>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(diagram, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'diagrama.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = (file: File) => {
    void file.text().then((text) => {
      try {
        load(JSON.parse(text) as Diagram);
      } catch {
        alert('Ese archivo no contiene un diagrama válido.');
      }
    });
  };

  const share = () => {
    const url = shareUrl(diagram);
    history.replaceState(null, '', url);
    void navigator.clipboard?.writeText(url);
  };

  return (
    <aside className="panel palette">
      <h2>Paleta</h2>
      <div className="stack">
        {SHORTCUTS.map((s) => (
          <button key={s.kind} onClick={() => addNode(s.kind, nextPosition(diagram))}>
            <span>{s.label}</span>
            <kbd>{s.key.toUpperCase()}</kbd>
          </button>
        ))}
      </div>

      <h2>Plantillas</h2>
      <div className="stack">
        {EXAMPLES.map((ex) => (
          <button key={ex.id} title={ex.description} onClick={() => load(ex.diagram)}>
            <span>{ex.name}</span>
            <kbd>{ex.id}</kbd>
          </button>
        ))}
      </div>

      <h2>Documento</h2>
      <div className="stack">
        <button onClick={exportJson}>Exportar JSON</button>
        <button onClick={() => fileInput.current?.click()}>Importar JSON</button>
        <button onClick={share}>Copiar enlace</button>
        <button className="danger" onClick={() => reset()}>
          Lienzo en blanco
        </button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importJson(f);
          e.target.value = '';
        }}
      />
      <p className="hint">
        Arrastra de un conector a otro para conectar. Clic en una conexión para borrarla. Supr elimina lo
        seleccionado.
      </p>
    </aside>
  );
}
