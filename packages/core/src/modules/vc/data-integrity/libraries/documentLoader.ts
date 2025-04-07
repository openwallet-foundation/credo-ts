import type { AgentContext } from '../../../../agent/context/AgentContext'
import type { DocumentLoader } from './jsonld'

import { CredoError } from '../../../../error/CredoError'
import { isDid } from '../../../../utils'
import { DidResolverService } from '../../../dids'

import { DEFAULT_CONTEXTS } from './contexts'
import jsonld from './jsonld'
import { getNativeDocumentLoader } from './nativeDocumentLoader'

export type DocumentLoaderWithContext = (agentContext: AgentContext) => DocumentLoader

export function defaultDocumentLoader(agentContext: AgentContext): DocumentLoader {
  const didResolver = agentContext.dependencyManager.resolve(DidResolverService)

  async function loader(url: string) {
    // Check if in the default contexts shipped with Credo
    if (url in DEFAULT_CONTEXTS) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: DEFAULT_CONTEXTS[url as keyof typeof DEFAULT_CONTEXTS],
      }
    }

    const withoutFragment = url.split('#')[0]
    if (withoutFragment in DEFAULT_CONTEXTS) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: DEFAULT_CONTEXTS[url as keyof typeof DEFAULT_CONTEXTS],
      }
    }

    if (isDid(url)) {
      const result = await didResolver.resolve(agentContext, url)

      if (result.didResolutionMetadata.error || !result.didDocument) {
        throw new CredoError(`Unable to resolve DID: ${url}`)
      }

      const framed = await jsonld.frame(
        result.didDocument.toJSON(),
        {
          '@context': result.didDocument.context,
          '@embed': '@never',
          id: url,
        },
        // @ts-ignore
        { documentLoader: this }
      )

      return {
        contextUrl: null,
        documentUrl: url,
        document: framed,
      }
    }

    // fetches the documentLoader from documentLoader.ts or documentLoader.native.ts depending on the platform at bundle time
    const platformLoader = getNativeDocumentLoader()
    const nativeLoader = platformLoader.apply(jsonld, [])

    return await nativeLoader(url)
  }

  return loader.bind(loader)
}
