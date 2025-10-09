import type { DocumentLoader } from './jsonld'

export async function getNativeDocumentLoader(): Promise<() => DocumentLoader> {
  // @ts-ignore package doesn't have types
  const loader = await import('@digitalcredentials/jsonld/lib/documentLoaders/node')

  return loader as () => DocumentLoader
}
