import { useState } from 'react';
import type { Solution } from '../../engine/index.ts';
import { isSingular, resultToLatex, resultToString } from '../../engine/mason.ts';
import { Math } from '../Math.tsx';
import { DeltaBuilder } from '../DeltaBuilder/DeltaBuilder.tsx';
import { Inspector } from '../Inspector.tsx';
import { ReductionPanel } from '../Reduction/ReductionPanel.tsx';

export function ResultPanel({ solution }: { solution: Solution }) {
  const [tab, setTab] = useState<'resultado' | 'pasos' | 'elemento'>('resultado');
  const { result, error, issues, reduction } = solution;
  const errorCount = issues.filter((i) => i.level === 'error').length;

  return (
    <aside className="panel result">
      <div className="tabs">
        <button className={tab === 'resultado' ? 'on' : ''} onClick={() => setTab('resultado')}>
          Resultado
        </button>
        <button
          className={tab === 'pasos' ? 'on' : ''}
          onClick={() => setTab('pasos')}
          disabled={!reduction}
          title={reduction ? 'La reducción paso a paso' : 'Sin diagrama válido que reducir'}
        >
          Pasos
        </button>
        <button className={tab === 'elemento' ? 'on' : ''} onClick={() => setTab('elemento')}>
          Elemento{errorCount ? ` (${errorCount})` : ''}
        </button>
      </div>

      {tab === 'elemento' ? (
        <Inspector issues={issues} />
      ) : tab === 'pasos' ? (
        reduction ? (
          <ReductionPanel reduction={reduction} />
        ) : (
          <p className="hint">Corrige los errores del diagrama para ver la reducción.</p>
        )
      ) : (
        <div className="result-body">
          {error && <p className="issues error">{error}</p>}

          {!result && !error && (
            <p className="hint">
              {errorCount
                ? 'Corrige los errores marcados en el lienzo para obtener la función de transferencia.'
                : 'Dibuja un diagrama para empezar.'}
            </p>
          )}

          {result && (
            <>
              {isSingular(result) ? (
                // Δ = 0: enseñar `algo / 0` como si fuera la respuesta sería peor que no
                // enseñar nada. El aviso de `mason` explica el porqué justo debajo.
                <p className="issues error">Este sistema no tiene función de transferencia.</p>
              ) : (
                <div className="transfer">
                  <Math display tex={`\\frac{C(s)}{R(s)} = ${resultToLatex(result)}`} />
                </div>
              )}

              <div className="counters">
                <span>
                  Caminos <b>{result.paths.length}</b>
                </span>
                <span>
                  Lazos <b>{result.loops.length}</b>
                </span>
                <span>
                  Términos de Δ <b>{result.delta.terms.length + 1}</b>
                </span>
              </div>

              {result.warnings.map((w, i) => (
                <p key={i} className="issues warning">
                  {w}
                </p>
              ))}

              <button
                className="copy"
                onClick={() => void navigator.clipboard?.writeText(resultToLatex(result))}
                title={resultToString(result)}
              >
                Copiar LaTeX
              </button>

              <DeltaBuilder result={result} />
            </>
          )}
        </div>
      )}
    </aside>
  );
}
