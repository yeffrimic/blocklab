import { useEffect, useRef, useState } from 'react';
import type { Reduction, ReductionStep } from '../../engine/reduce.ts';
import { ratioToLatex } from '../../engine/polynomial/ratio.ts';
import { useDiagram, type Highlight } from '../../store/useDiagram.ts';
import { Math } from '../Math.tsx';
import { GraphView } from './GraphView.tsx';

/** Nombre corto de la regla, para la etiqueta del paso. */
const RULE: Record<ReductionStep['kind'], string> = {
  series: 'cascada',
  parallel: 'paralelo',
  selfloop: 'lazo',
  eliminate: 'reparto',
};

const toHighlight = (s: ReductionStep): Highlight => ({
  nodes: new Set(s.via.blocks),
  edges: new Set(s.via.edges),
});

const PERIOD = 1900;

export function ReductionPanel({ reduction }: { reduction: Reduction }) {
  const setHighlight = useDiagram((s) => s.setHighlight);
  const { steps, start, result, matchesMason, singular } = reduction;

  // 0 es el grafo de partida; 1..n son los pasos.
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  const last = steps.length;
  const current = at === 0 ? null : steps[at - 1]!;
  const graph = current ? current.graph : start;

  // Se vuelve al principio solo si cambia la estructura de la reducción. Mover un
  // nodo por el lienzo recalcula la solución pero no cambia los pasos, y perder
  // ahí el sitio en la reproducción era molesto.
  const shape = steps.map((s) => `${s.kind}@${s.at ?? ''}`).join('|');
  useEffect(() => {
    setAt(0);
    setPlaying(false);
  }, [shape]);

  useEffect(() => {
    if (!playing) return;
    if (at >= last) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setAt((k) => k + 1), PERIOD);
    return () => clearTimeout(t);
  }, [playing, at, last]);

  // El paso activo resalta en el lienzo los bloques y conexiones que consumió.
  useEffect(() => {
    setHighlight(current ? toHighlight(current) : null);
    return () => setHighlight(null);
  }, [current, setHighlight]);

  useEffect(() => {
    const li = listRef.current?.children[at] as HTMLElement | undefined;
    li?.scrollIntoView({ block: 'nearest' });
  }, [at]);

  if (!matchesMason) {
    return (
      <div className="reduction">
        <p className="issues warning">
          {singular
            ? 'Aquí no hay nada que reducir: la ganancia de lazo vale exactamente 1, el denominador se anula y el sistema no tiene función de transferencia. Suele ser un signo de sumador al revés.'
            : result === null
            ? 'Este diagrama es demasiado enrevesado para contarlo paso a paso: la reducción se quedó sin pasos antes de terminar.'
            : 'La reducción paso a paso no coincidió con lo que da Mason en este diagrama, así que no se muestra: sería contar algo que no es verdad.'}{' '}
          {!singular && (
            <>
              La función de transferencia de la pestaña <em>Resultado</em> sigue siendo válida:
              la calcula Mason, que no depende de esta narración.
            </>
          )}
        </p>
      </div>
    );
  }

  // Sin `Math.min`: el componente de KaTeX se llama `Math` y tapa el global.
  const go = (k: number) => {
    setPlaying(false);
    setAt(k < 0 ? 0 : k > last ? last : k);
  };

  return (
    <div className="reduction">
      <div className="reduction-stage">
        <GraphView graph={graph} />
      </div>

      <div className="reduction-controls">
        <button
          className="play"
          onClick={() => (at >= last ? (setAt(0), setPlaying(true)) : setPlaying(!playing))}
        >
          {playing ? '❚❚ Pausa' : '▶ Reproducir'}
        </button>
        <button onClick={() => go(at - 1)} disabled={at === 0} title="Paso anterior">
          ‹
        </button>
        <button onClick={() => go(at + 1)} disabled={at === last} title="Paso siguiente">
          ›
        </button>
        <span className="counter">
          {at} / {last}
        </span>
      </div>

      <ol className="reduction-steps" ref={listRef}>
        <li className={at === 0 ? 'on' : ''}>
          <button onClick={() => go(0)}>
            <span className="tag">inicio</span>
            <span className="what">
              <b>El diagrama, como grafo</b>
              <span className="why">
                Los bloques dejan de ser cajas y pasan a ser ramas: cada rama lleva el producto
                de las ganancias por las que pasa, con el signo del puerto del sumador donde
                termina. Los puntos son los sumadores y las bifurcaciones. Dibujado así, reducir
                el diagrama es ir quitando puntos hasta que solo queden la entrada y la salida.
              </span>
            </span>
          </button>
        </li>

        {steps.map((s, i) => (
          <li key={i} className={at === i + 1 ? 'on' : ''}>
            <button
              onClick={() => go(i + 1)}
              onMouseEnter={() => setHighlight(toHighlight(s))}
              onMouseLeave={() => setHighlight(current ? toHighlight(current) : null)}
            >
              <span className="tag">{RULE[s.kind]}</span>
              <span className="what">
                <b>{s.title}</b>
                <span className="why">{s.detail}</span>
                {s.loopGain && (
                  <span className="gain loop">
                    <Math tex={`L = ${ratioToLatex(s.loopGain)}`} />
                  </span>
                )}
                {s.gain && (
                  <span className="gain">
                    <Math tex={ratioToLatex(s.gain)} />
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {result && (
        <div className="reduction-result">
          <span className="tag">Queda</span>
          <Math display tex={`\\frac{C(s)}{R(s)} = ${ratioToLatex(result)}`} />
          <p className="hint">
            Comprobado contra Mason por multiplicación cruzada: la reducción es solo la
            narración, no la fuente de verdad.
          </p>
        </div>
      )}
    </div>
  );
}
