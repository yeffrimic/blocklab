# BlockLab

Editor y solucionador de diagramas de bloques de control. Dibuja el diagrama, obtén
`C(s)/R(s)` exacta y simbólica por la fórmula de Mason, y mira cómo se construye Δ
término por término.

La especificación completa está en [SPEC.md](SPEC.md). Esto es la **Fase 1**.

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 53 pruebas del motor
npm run typecheck
npm run build
```

## Publicar

No hay backend: el resultado de `npm run build` es una carpeta estática que sirve
cualquier hosting. `base: './'` en `vite.config.ts` deja las rutas relativas, así que
`dist/` funciona en la raíz de un dominio, en un subdirectorio o abierta desde el disco.

```bash
npm run build     # deja ~1,9 MB en dist/
```

Arrastra `dist/` a [app.netlify.com/drop](https://app.netlify.com/drop) y sale publicada
al momento. Sin cuenta el sitio es temporal: para conservarlo hay que reclamarlo con una
cuenta gratuita. Cada actualización es reconstruir y volver a arrastrar.

## Qué hay implementado

| Área | Estado |
|---|---|
| Modelo de datos serializable | ✅ `src/engine/types.ts` |
| Diagrama → SFG (bloques como aristas) | ✅ `src/engine/sfg/build.ts` |
| Caminos directos (DFS sobre aristas) | ✅ `src/engine/sfg/paths.ts` |
| Lazos elementales (Johnson 1975) | ✅ `src/engine/sfg/loops.ts` |
| Conjuntos de lazos no adyacentes | ✅ `src/engine/sfg/nontouching.ts` |
| Fórmula de Mason | ✅ `src/engine/mason.ts` |
| Álgebra de polinomios con racionales `bigint` | ✅ `src/engine/polynomial/` |
| Validaciones en vivo con mensajes concretos | ✅ `src/engine/validate.ts` |
| Editor con React Flow, KaTeX, panel de Δ | ✅ `src/ui/` |
| Fixtures T1–T8 | ✅ `tests/` y `tests/fixtures/*.json` |
| Fase 2 (numérico) y Fase 3 (pasos) | ⬜ pendientes |

## Cómo se usa el editor

- **Paleta** (izquierda): inserta elementos, o usa los atajos `B` bloque, `S` sumador,
  `N` bifurcación, `E` entrada, `C` salida. Las plantillas cargan los siete casos de
  referencia.
- **Lienzo**: los puntos que se ven en un nodo son sus salidas, una por lado. Tira de
  cualquiera de ellos y la flecha sale justo de ahí; suéltala cerca del destino y entra
  por el lado más próximo. El lado elegido se guarda con la arista (`fromSide`/`toSide`);
  si falta — plantillas, diagramas antiguos — se deduce de las posiciones, y una arista
  que retrocede se dibuja como realimentación. Clic sobre una conexión para borrarla;
  `Supr` elimina lo seleccionado.
- **Panel derecho**, pestaña *Resultado*: la función de transferencia, los caminos, los
  lazos y la construcción de Δ. Al pasar el cursor sobre un término de Δ se resalta en el
  lienzo el lazo que lo originó.
- **Pestaña *Elemento***: ganancia del bloque seleccionado, signos de los puertos del
  sumador y su lado de salida — `⊕ →` o `← ⊕`, para espejarlo en una rama que va de
  derecha a izquierda —, símbolos declarados y la lista de errores y avisos.

El diagrama se autoguarda en `localStorage`. *Copiar enlace* comprime el diagrama en el
fragmento de la URL, sin backend.

## Notas de arquitectura

**Mason es la única fuente de verdad.** No hay un motor que reduzca el diagrama paso a
paso y devuelva el resultado: esa reducción se atasca en diagramas entrelazados. La
Fase 3 añadirá la narrativa de reducción como capa de presentación, verificada contra
Mason en cada paso.

**El motor no depende de React.** `src/engine/` es TypeScript puro, sin importaciones
externas ni APIs del navegador; `tests/engine/isolation.test.ts` lo verifica en cada
ejecución de la suite.

**Aritmética exacta.** Los coeficientes son racionales sobre `bigint`. Un término que
debe cancelarse se cancela a cero exacto, no a `1e-17`.

**La forma factorizada es solo presentación.** El resultado se muestra con el factor
común sacado — `G1G2 / (1 + G1G2(G3 + G4))`, como en cualquier libro — pero el motor
opera siempre sobre la forma expandida. El desglose de Δ se queda expandido a propósito:
ahí lo que se explica es el término a término.

**El signo vive en el puerto del sumador**, nunca en la arista. Es la causa habitual de
los errores de signo, y T4 (realimentación positiva) y T7 lo cubren desde el primer día.

## Estructura

```
src/engine/       motor puro: polinomios, SFG, Mason, validación, diagramas de referencia
src/ui/           Canvas (React Flow), Palette, ResultPanel, DeltaBuilder, Inspector
src/store/        estado del documento (Zustand) y autoguardado
tests/engine/     T1–T8, álgebra, aislamiento del motor
tests/fixtures/   los mismos diagramas en JSON (`npm run fixtures` los regenera)
```
