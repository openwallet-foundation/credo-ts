import type { DocumentLoader } from './jsonld'

export function getNativeDocumentLoader(): () => DocumentLoader {
  // biome-ignore lint/correctness/noUndeclaredDependencies: <explanation>
  const loader = require('@digitalcredentials/jsonld/lib/documentLoaders/xhr')

  return loader as () => DocumentLoader
}
