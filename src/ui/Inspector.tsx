import { useDiagram } from '../store/useDiagram.ts';
import type { Issue } from '../engine/validate.ts';

interface Props {
  issues: Issue[];
}

/** Edición del elemento seleccionado, símbolos declarados y lista de avisos. */
export function Inspector({ issues }: Props) {
  const diagram = useDiagram((s) => s.diagram);
  const selectedId = useDiagram((s) => s.selected);
  const {
    setGain,
    setLabel,
    addPort,
    removePort,
    togglePort,
    setSumFacing,
    removeNodes,
    declareSymbol,
    removeSymbol,
    syncSymbols,
  } = useDiagram.getState();

  const node = diagram.nodes.find((n) => n.id === selectedId);
  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');
  const missing = [...new Set(errors.flatMap((i) => (i.fix?.kind === 'declare-symbol' ? [i.fix.symbol] : [])))];

  return (
    <div className="inspector">
      <h2>Elemento</h2>
      {!node && <p className="hint">Selecciona un elemento del lienzo para editarlo.</p>}

      {node?.kind === 'block' && (
        <label className="field">
          Ganancia
          <input
            value={node.gain}
            placeholder="G1"
            autoFocus
            onChange={(e) => setGain(node.id, e.target.value)}
          />
        </label>
      )}

      {(node?.kind === 'source' || node?.kind === 'sink') && (
        <label className="field">
          Etiqueta
          <input value={node.label} onChange={(e) => setLabel(node.id, e.target.value)} />
        </label>
      )}

      {node?.kind === 'sum' && (
        <div className="ports">
          {node.ports.map((p) => (
            <div key={p.id} className="port-row">
              <button className="sign" onClick={() => togglePort(node.id, p.id)} title="Cambiar el signo">
                {p.sign === 1 ? '+' : '−'}
              </button>
              <span>puerto {p.id}</span>
              <button className="x" onClick={() => removePort(node.id, p.id)} title="Quitar el puerto">
                ×
              </button>
            </div>
          ))}
          <div className="stack row">
            <button onClick={() => addPort(node.id, 1)}>Puerto +</button>
            <button onClick={() => addPort(node.id, -1)}>Puerto −</button>
          </div>
          <label className="field">
            Salida
            <div className="stack row">
              <button
                className={(node.facing ?? 'right') === 'right' ? 'on' : ''}
                onClick={() => setSumFacing(node.id, 'right')}
                title="Entradas por la izquierda, salida por la derecha"
              >
                ⊕ →
              </button>
              <button
                className={node.facing === 'left' ? 'on' : ''}
                onClick={() => setSumFacing(node.id, 'left')}
                title="Sumador espejado: entradas por la derecha, salida por la izquierda"
              >
                ← ⊕
              </button>
            </div>
          </label>
        </div>
      )}

      {node?.kind === 'pickoff' && <p className="hint">Copia la señal sin alterarla: ganancia 1.</p>}

      {node && (
        <button className="danger" onClick={() => removeNodes([node.id])}>
          Eliminar elemento
        </button>
      )}

      <h2>Símbolos</h2>
      <div className="chips">
        {diagram.symbols.map((s) => (
          <span key={s.name} className="chip">
            {s.name}
            <button onClick={() => removeSymbol(s.name)} title="Quitar la declaración">
              ×
            </button>
          </span>
        ))}
        {!diagram.symbols.length && <span className="hint">Ninguno declarado todavía.</span>}
      </div>
      {missing.length > 0 && (
        <div className="stack row">
          {missing.map((s) => (
            <button key={s} onClick={() => declareSymbol(s)}>
              Declarar {s}
            </button>
          ))}
          {missing.length > 1 && <button onClick={() => syncSymbols()}>Declarar todos</button>}
        </div>
      )}

      {(errors.length > 0 || warnings.length > 0) && (
        <>
          <h2>Revisión</h2>
          <ul className="issues">
            {errors.map((i, k) => (
              <li key={`e${k}`} className="error">
                {i.message}
              </li>
            ))}
            {warnings.map((i, k) => (
              <li key={`w${k}`} className="warning">
                {i.message}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
