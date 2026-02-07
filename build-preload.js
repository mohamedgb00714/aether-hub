import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

build({
  entryPoints: [join(__dirname, 'electron/preload.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: join(__dirname, 'dist-electron/preload.cjs'),
  external: ['electron'],
  minify: false,
  sourcemap: false
}).catch(() => process.exit(1));
