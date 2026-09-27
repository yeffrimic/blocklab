import { useEffect } from 'react';
import { useDiagram } from './store/useDiagram.ts';
import { useSolution } from './ui/useSolution.ts';
import { Canvas } from './ui/Canvas/Canvas.tsx';
import { Palette, SHORTCUTS, nextPosition } from './ui/Palette/Palette.tsx';
import { ResultPanel } from './ui/ResultPanel/ResultPanel.tsx';

export default function App() {
  const diagram = useDiagram((s) => s.diagram);
  const solution = useSolution(diagram);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const s = SHORTCUTS.find((x) => x.key === ev.key.toLowerCase());
      if (!s) return;
      ev.preventDefault();
      const { addNode, diagram: d } = useDiagram.getState();
      addNode(s.kind, nextPosition(d));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="app">
      <header>
        <h1><a href="../" title="Volver al inicio">BlockLab</a></h1>
        <p>Editor y solucionador de diagramas de bloques — fórmula de Mason</p>
      </header>
      <main>
        <Palette />
        <Canvas issues={solution.issues} />
        <ResultPanel solution={solution} />
      </main>
    </div>
  );
}
