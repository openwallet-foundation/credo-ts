import type { DocumentLoader } from './jsonld'

export function getNativeDocumentLoader(): () => DocumentLoader {
  // biome-ignore lint/correctness/noUndeclaredDependencies: <explanation>
  const loader = require('@digitalcredentials/jsonld/lib/documentLoaders/node')

  return loader as () => DocumentLoader
}
