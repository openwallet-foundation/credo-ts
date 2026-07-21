import type { AgentContext } from '../../../agent'
import { InjectionSymbols } from '../../../constants'
import { CredoError } from '../../../error'
import type { Logger } from '../../../logger'
import { inject, injectable } from '../../../plugins'
import { JsonTransformer } from '../../../utils'
import { CacheModuleConfig } from '../../cache'
import { DidsModuleConfig } from '../DidsModuleConfig'
import { DidDocument } from '../domain'
import type { DidResolver } from '../domain/DidResolver'
import { parseDid } from '../domain/parse'
import { DidRepository } from '../repository'
import type { DidResolutionOptions, DidResolutionResult, ParsedDid } from '../types'

/**
 * Did methods whose documents live in public, context-independent sources: resolving them yields
 * the same result in any agent context, so their documents are cached in the global scope shared
 * across all agent contexts. Documents of other did methods are cached per agent context.
 */
const PUBLIC_DID_METHODS = ['web', 'indy', 'sov', 'cheqd', 'hedera', 'webvh']

@injectable()
export class DidResolverService {
  private logger: Logger
  private didsModuleConfig: DidsModuleConfig
  private didRepository: DidRepository

  public constructor(
    @inject(InjectionSymbols.Logger) logger: Logger,
    didsModuleConfig: DidsModuleConfig,
    didRepository: DidRepository
  ) {
    this.logger = logger
    this.didsModuleConfig = didsModuleConfig
    this.didRepository = didRepository
  }

  public async resolve(
    agentContext: AgentContext,
    didUrl: string,
    options: DidResolutionOptions = {}
  ): Promise<DidResolutionResult> {
    this.logger.debug(`resolving didUrl ${didUrl}`)

    const result = {
      didResolutionMetadata: {},
      didDocument: null,
      didDocumentMetadata: {},
    }

    let parsed: ParsedDid
    try {
      parsed = parseDid(didUrl)
    } catch (_error) {
      return {
        ...result,
        didResolutionMetadata: { error: 'invalidDid' },
      }
    }

    const resolver = this.findResolver(parsed)
    if (!resolver) {
      return {
        ...result,
        didResolutionMetadata: {
          error: 'unsupportedDidMethod',
          message: `No did resolver registered for did method ${parsed.method}`,
        },
      }
    }

    // extract caching options and set defaults
    const {
      useCache = true,
      cacheDurationInSeconds = 300,
      persistInCache = true,
      useLocalCreatedDidRecord = true,
    } = options
    const { cacheKey, cacheScope } = this.getCacheKeyAndScope(parsed)

    if (resolver.allowsCaching && useCache) {
      const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
      const cachedDidDocument = await cache.get<DidResolutionResult & { didDocument: Record<string, unknown> }>(
        agentContext,
        cacheKey,
        { scope: cacheScope }
      )

      if (cachedDidDocument) {
        return {
          ...cachedDidDocument,
          didDocument: JsonTransformer.fromJSON(cachedDidDocument.didDocument, DidDocument),
          didResolutionMetadata: {
            ...cachedDidDocument.didResolutionMetadata,
            servedFromCache: true,
          },
        }
      }
    }

    // TODO: we should store the document for future reference
    if (resolver.allowsLocalDidRecord && useLocalCreatedDidRecord) {
      // TODO: did should have tag whether a did document is present in the did record
      const [didRecord] = await this.didRepository.getCreatedDids(agentContext, {
        did: parsed.did,
      })

      if (didRecord?.didDocument) {
        return {
          didDocument: didRecord.didDocument,
          didDocumentMetadata: {},
          didResolutionMetadata: {
            servedFromCache: false,
            servedFromDidRecord: true,
          },
        }
      }
    }

    let resolutionResult = await resolver.resolve(agentContext, parsed.did, parsed, options)
    // Avoid overwriting existing document
    resolutionResult = {
      ...resolutionResult,
      didResolutionMetadata: {
        ...resolutionResult.didResolutionMetadata,
        resolutionTime: Date.now(),
        // Did resolver implementation might use did method specific caching strategy
        // We only set to false if not defined by the resolver
        servedFromCache: resolutionResult.didResolutionMetadata.servedFromCache ?? false,
      },
    }

    if (resolutionResult.didDocument && resolver.allowsCaching && persistInCache) {
      const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache
      await cache.set(
        agentContext,
        cacheKey,
        {
          ...resolutionResult,
          didDocument: resolutionResult.didDocument.toJSON(),
        },
        // Set cache duration
        cacheDurationInSeconds,
        { scope: cacheScope }
      )
    }

    return resolutionResult
  }

  /**
   * Resolve a did document. This uses the default resolution options, and thus
   * will use caching if available.
   */
  public async resolveDidDocument(agentContext: AgentContext, did: string) {
    const {
      didDocument,
      didResolutionMetadata: { error, message },
    } = await this.resolve(agentContext, did)

    if (!didDocument) {
      throw new CredoError(`Unable to resolve did document for did '${did}': ${error} ${message}`)
    }
    return didDocument
  }

  public async invalidateCacheForDid(agentContext: AgentContext, did: string) {
    const cache = agentContext.dependencyManager.resolve(CacheModuleConfig).cache

    let parsed: ParsedDid
    try {
      parsed = parseDid(did)
    } catch (_error) {
      // If the did is invalid, there is no cache to invalidate, so we can just return
      return
    }

    const { cacheKey, cacheScope } = this.getCacheKeyAndScope(parsed)
    await cache.remove(agentContext, cacheKey, { scope: cacheScope })
  }

  private getCacheKeyAndScope(parsed: ParsedDid): { cacheKey: string; cacheScope: 'context' | 'global' } {
    return {
      cacheKey: `did:resolver:${parsed.did}`,
      cacheScope: PUBLIC_DID_METHODS.includes(parsed.method) ? 'global' : 'context',
    }
  }

  private findResolver(parsed: ParsedDid): DidResolver | null {
    return this.didsModuleConfig.resolvers.find((r) => r.supportedMethods.includes(parsed.method)) ?? null
  }

  /**
   * Get all supported did methods for the did resolver.
   */
  public get supportedMethods() {
    return Array.from(new Set(this.didsModuleConfig.resolvers.flatMap((r) => r.supportedMethods)))
  }
}
