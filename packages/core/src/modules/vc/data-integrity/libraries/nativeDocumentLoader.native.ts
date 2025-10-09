import type { DocumentLoader } from './jsonld'

export async function getNativeDocumentLoader(): Promise<() => DocumentLoader> {
  // @ts-ignore package doesn't have types
  const loader = await import('@digitalcredentials/jsonld/lib/documentLoaders/xhr')

  if (!loader) throw new Error('Could not load node document loader. Module did not contain a loader function')
  if (typeof loader === 'function') return loader
  if (typeof loader === 'object' && typeof loader.default === 'function') return loader.default

  throw new Error('Could not load node document loader. Module did not contain a loader function.')
}
