/* Genera tests/fixtures/*.json a partir de los diagramas de referencia. */
import { writeFileSync } from 'node:fs';
import { EXAMPLES, INVALID_FREE_PORT, INVALID_NO_SINK, INVALID_SELF_LOOP, INVALID_UNDECLARED, INVALID_UNREACHABLE } from './src/engine/examples.ts';

const extra = {
  'invalid-no-sink': INVALID_NO_SINK,
  'invalid-free-port': INVALID_FREE_PORT,
  'invalid-undeclared': INVALID_UNDECLARED,
  'invalid-unreachable': INVALID_UNREACHABLE,
  'invalid-self-loop': INVALID_SELF_LOOP,
};

for (const ex of EXAMPLES) {
  writeFileSync(`tests/fixtures/${ex.id}.json`, JSON.stringify(ex.diagram, null, 2) + '\n');
}
for (const [name, d] of Object.entries(extra)) {
  writeFileSync(`tests/fixtures/${name}.json`, JSON.stringify(d, null, 2) + '\n');
}
console.log('fixtures escritos');
