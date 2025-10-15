import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const srcRoot = path.join(projectRoot, 'src');

export async function load(url, context, defaultLoad) {
  if (url.startsWith('file://')) {
    const filePath = fileURLToPath(url);
    if (filePath.startsWith(srcRoot) && filePath.endsWith('.js')) {
      return defaultLoad(url, { ...context, format: 'module' });
    }
  }
  return defaultLoad(url, context);
}
