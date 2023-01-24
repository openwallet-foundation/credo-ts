import type { DocumentLoader } from './jsonld'
import type { AgentContext } from '../../../agent/context/AgentContext'

import { AriesFrameworkError } from '../../../error/AriesFrameworkError'
import { DidResolverService } from '../../dids'

import jsonld from './jsonld'
import { getNativeDocumentLoader } from './nativeDocumentLoader'

export type DocumentLoaderWithContext = (agentContext: AgentContext) => DocumentLoader

export function defaultDocumentLoader(agentContext: AgentContext): DocumentLoader {
  const didResolver = agentContext.dependencyManager.resolve(DidResolverService)

  async function loader(url: string) {
    if (url.startsWith('did:')) {
      const result = await didResolver.resolve(agentContext, url)

      if (result.didResolutionMetadata.error || !result.didDocument) {
        throw new AriesFrameworkError(`Unable to resolve DID: ${url}`)
      }

      const framed = await jsonld.frame(
        result.didDocument.toJSON(),
        {
          '@context': result.didDocument.context,
          '@embed': '@never',
          id: url,
        },
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
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
