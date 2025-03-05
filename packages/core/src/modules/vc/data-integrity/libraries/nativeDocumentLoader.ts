import type { DocumentLoader } from './jsonld'

export function getNativeDocumentLoader(): () => DocumentLoader {
  const loader = require('@digitalcredentials/jsonld/lib/documentLoaders/node')

  return loader as () => DocumentLoader
}
