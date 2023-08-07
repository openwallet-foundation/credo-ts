import type { DocumentLoader } from './jsonld'

export function getNativeDocumentLoader(): () => DocumentLoader {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const loader = require('@digitalcredentials/jsonld/lib/documentLoaders/xhr')

  return loader as () => DocumentLoader
}
