import { useMemo } from 'react';
import katex from 'katex';

interface Props {
  tex: string;
  display?: boolean;
}

/** Fórmula renderizada con KaTeX. Si el TeX es inválido, se muestra el origen en crudo. */
export function Math({ tex, display = false }: Props) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html' });
    } catch {
      return null;
    }
  }, [tex, display]);

  if (html === null) return <code>{tex}</code>;
  return <span className={display ? 'math-display' : 'math-inline'} dangerouslySetInnerHTML={{ __html: html }} />;
}
