import { zipSync, strToU8 } from 'fflate';
import type { ArtifactSet } from '../core/types.js';

/** An export must not create unsafe extraction paths or collapse feature directories. */
export function artifactArchive(set: ArtifactSet): ArrayBuffer {
  const files: Record<string, Uint8Array> = Object.create(null);
  let size = 0;
  for (const artifact of set.artifacts) {
    const path = artifact.path.replaceAll('\\', '/');
    if (/^(?:\/|[A-Za-z]:)/.test(path) || path.includes('\0') || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('Unsafe artifact export path.');
    if (Object.hasOwn(files, path)) throw new Error('Duplicate artifact export path.');
    const bytes = strToU8(artifact.content);
    size += bytes.length;
    if (size > 20_000_000) throw new Error('Artifact archive exceeds 20 MB. Export one feature at a time.');
    files[path] = bytes;
  }
  return new Uint8Array(zipSync(files, { level: 0 })).buffer;
}
