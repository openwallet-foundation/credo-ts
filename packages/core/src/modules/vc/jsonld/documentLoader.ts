import type { AgentContext } from '../../../agent/context/AgentContext'
import { CredoError } from '../../../error/CredoError'
import { isDid } from '../../../utils'
import { isAllowedHttpUrl } from '../../../utils/uri'
import { DidResolverService } from '../../dids'
import { DEFAULT_CONTEXTS } from './contexts'
import { JsonLdModuleConfig } from './JsonLdModuleConfig'
import type { DocumentLoader, DocumentLoaderResult } from './jsonld'
import jsonld from './jsonld'

const LINK_HEADER_CONTEXT = 'http://www.w3.org/ns/json-ld#context'

export type DocumentLoaderWithContext = (agentContext: AgentContext) => DocumentLoader

export function defaultDocumentLoader(
  agentContext: AgentContext,
  additionalContexts: Record<string, unknown> = {}
): DocumentLoader {
  const didResolver = agentContext.dependencyManager.resolve(DidResolverService)
  const contexts = { ...DEFAULT_CONTEXTS, ...additionalContexts }

  async function loader(url: string) {
    // Check if in the default contexts shipped with Credo
    if (url in contexts) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: contexts[url as keyof typeof contexts],
      }
    }

    const withoutFragment = url.split('#')[0]
    if (withoutFragment in contexts) {
      return {
        contextUrl: null,
        documentUrl: url,
        document: contexts[withoutFragment as keyof typeof contexts],
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
        // @ts-expect-error
        { documentLoader: this }
      )

      return {
        contextUrl: null,
        documentUrl: url,
        document: framed,
      }
    }

    return fetchRemoteDocument(url, true)
  }

  // Mirrors the jsonld.js node and xhr document loaders, but fetches with the agent fetch and its limits
  async function fetchRemoteDocument(url: string, followAlternate: boolean): Promise<DocumentLoaderResult> {
    assertAllowedUrl(url)

    const response = await agentContext.config.fetch(url, {
      headers: { Accept: 'application/ld+json, application/json' },
      maxResponseBytes: agentContext.resolve(JsonLdModuleConfig).maxDocumentBytes,
    })

    // Redirects are followed by fetch, so the final url is checked too and used as the base url
    const documentUrl = response.url || url
    assertAllowedUrl(documentUrl)

    if (!response.ok) {
      throw new CredoError(`Unable to load JSON-LD document '${url}'. Received response with status ${response.status}`)
    }

    const contentType = response.headers.get('content-type')?.split(';')[0].trim()
    const linkHeader = response.headers.get('link')
    let contextUrl: string | null = null

    if (linkHeader && contentType !== 'application/ld+json') {
      const links = jsonld.util.parseLinkHeader(linkHeader)

      const linkedContext = links[LINK_HEADER_CONTEXT]
      if (Array.isArray(linkedContext)) {
        throw new CredoError(`Unable to load JSON-LD document '${url}'. It has more than one context Link header.`)
      }
      contextUrl = linkedContext?.target ?? null

      // An 'alternate' link to a JSON-LD document is a redirect for responses that aren't JSON. Followed once, so a
      // server can't chain them
      const alternate = links.alternate
      if (
        followAlternate &&
        alternate &&
        !Array.isArray(alternate) &&
        alternate.type === 'application/ld+json' &&
        !/^application\/(\w*\+)?json$/.test(contentType ?? '')
      ) {
        return fetchRemoteDocument(new URL(alternate.target, documentUrl).href, false)
      }
    }

    return {
      contextUrl,
      documentUrl,
      document: (await response.json()) as Record<string, unknown>,
    }
  }

  function assertAllowedUrl(url: string) {
    if (!isAllowedHttpUrl(url, agentContext.config.allowInsecureHttpUrls)) {
      throw new CredoError(`Unable to load JSON-LD document '${url}'. Only https urls are supported.`)
    }
  }

  return loader.bind(loader)
}
