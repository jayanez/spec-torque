import { zipSync, strToU8 } from 'fflate';
import type { ArtifactSet } from '../core/types.js';

/** An export must not create unsafe extraction paths or collapse feature directories. */
export function artifactArchive(set: ArtifactSet): ArrayBuffer {
  function* entries() {
    for (const artifact of set.artifacts) yield { path: artifact.path, bytes: strToU8(artifact.content) };
  }
  return zipArtifactBytes(entries());
}

export function zipArtifactBytes(artifacts: Iterable<{ path: string; bytes: Uint8Array }>): ArrayBuffer {
  const files: Record<string, Uint8Array> = Object.create(null);
  let size = 0;
  const portablePaths = new Set<string>();
  for (const artifact of artifacts) {
    const path = artifact.path.replaceAll('\\', '/');
    if (/^(?:\/|[A-Za-z]:)/.test(path) || /[\x00-\x1f<>:\"|?*]/.test(path) || path.split('/').some(p => !p || /[. ]$/.test(p) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p.normalize('NFKC')))) throw new Error('Unsafe artifact export path.');
    const normalized = path.normalize('NFKC');
    const portable = [normalized.toLowerCase(), normalized.toUpperCase()];
    if (portable.some(key => portablePaths.has(key))) throw new Error('Duplicate artifact export path on a portable filesystem.');
    portable.forEach(key => portablePaths.add(key));
    const bytes = artifact.bytes;
    size += bytes.length;
    if (size > 20_000_000) throw new Error('Artifact archive exceeds 20 MB. Export one feature at a time.');
    files[path] = bytes;
  }
  return new Uint8Array(zipSync(files, { level: 0 })).buffer;
}
