# BlockLab

Editor y solucionador de diagramas de bloques de control. Dibuja el diagrama, obtén
`C(s)/R(s)` exacta y simbólica por la fórmula de Mason, y mira cómo se construye Δ
término por término.

La especificación completa está en [SPEC.md](SPEC.md). Fase 1 y Fase 3 hechas.

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:5173 (presentación) y /app/ (editor)
npm test           # 95 pruebas
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
| Funciones racionales y división exacta | ✅ `src/engine/polynomial/ratio.ts` |
| Reducción narrada paso a paso (Fase 3) | ✅ `src/engine/reduce.ts`, `src/ui/Reduction/` |
| Fase 2 (numérico) | ⬜ pendiente |

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
- **Pestaña *Pasos***: la reducción contada paso a paso, con reproducción. Cada paso
  nombra la regla que aplica — cascada, paralelo, lazo cerrado — y resalta en el lienzo
  los bloques que consume. El grafo se dibuja como diagrama de arcos: las ramas de vuelta
  van por debajo.
- **Pestaña *Elemento***: ganancia del bloque seleccionado, signos de los puertos del
  sumador y su lado de salida — `⊕ →` o `← ⊕`, para espejarlo en una rama que va de
  derecha a izquierda —, símbolos declarados y la lista de errores y avisos.

El diagrama se autoguarda en `localStorage`. *Copiar enlace* codifica el diagrama en el
fragmento de la URL, sin backend. Los enlaces antiguos que apuntaban a la raíz se
reenvían solos a `app/`.

## Notas de arquitectura

**Los textos de los pasos son parte del producto.** Los pasos nombran las cosas como
las ve quien estudia — «el segundo sumador», «la primera bifurcación», numerados de
izquierda a derecha — y no por su id interno; hay pruebas que lo comprueban, incluidas
las contracciones del castellano. Cada paso dice también *por qué* se puede aplicar la
regla, no solo cuál es.

**Mason es la única fuente de verdad.** La pestaña *Pasos* narra una reducción, pero el
resultado que se da por bueno lo calcula Mason: la narración se contrasta con él por
multiplicación cruzada (`Reduction.matchesMason`) y el panel se calla si no cuadra.

**La reducción no es álgebra de bloques.** El álgebra de bloques se atasca en cuanto los
lazos se entrelazan, y entonces no habría nada que contar. Lo que hace `reduce.ts` es
eliminación de nodos sobre el grafo de flujo — Gauss sobre el grafo —, que termina
siempre, con cualquier diagrama. Lo que sí conserva es el vocabulario: cuando el patrón
coincide con una regla de libro se anuncia con su nombre, así que un diagrama corriente
produce la narración de siempre y uno entrelazado produce una algo más larga en vez de un
callejón sin salida. El orden de eliminación está sesgado a propósito hacia el nodo que
al irse deja un autolazo, porque el paso siguiente es entonces «cerrar el lazo».

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
index.html        página de presentación (HTML estático, sin React)
app/index.html    entrada del editor
src/engine/       motor puro: polinomios, racionales, SFG, Mason, reducción, validación
src/ui/           Canvas (React Flow), Palette, ResultPanel, DeltaBuilder, Reduction, Inspector
src/store/        estado del documento (Zustand) y autoguardado
tests/engine/     T1–T8, álgebra, reducción contra Mason, aislamiento del motor
tests/ui/         humo del panel con `renderToStaticMarkup`, sin DOM
tests/fixtures/   los mismos diagramas en JSON (`npm run fixtures` los regenera)
```
