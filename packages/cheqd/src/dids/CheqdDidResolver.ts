import type { ResourceWithMetadata } from '@cheqd/ts-proto/cheqd/resource/v2'
import type { AgentContext, DidResolutionResult, DidResolver, ParsedDid } from '@credo-ts/core'
import { CredoError, DidDocument, JsonTransformer, utils } from '@credo-ts/core'
import type { ParsedCheqdDid } from '../anoncreds/utils/identifiers'

import {
  cheqdDidMetadataRegex,
  cheqdDidRegex,
  cheqdDidVersionRegex,
  cheqdDidVersionsRegex,
  cheqdResourceMetadataRegex,
  cheqdResourceRegex,
  parseCheqdDid,
} from '../anoncreds/utils/identifiers'
import { CheqdLedgerService } from '../ledger'

import { getClosestResourceVersion, renderResourceData } from './didCheqdUtil'

export class CheqdDidResolver implements DidResolver {
  public readonly supportedMethods = ['cheqd']
  public readonly allowsCaching = true
  public readonly allowsLocalDidRecord = true

  public async resolve(agentContext: AgentContext, did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const parsedDid = parseCheqdDid(parsed.didUrl)
      if (!parsedDid) {
        throw new Error('Invalid DID')
      }

      switch (did) {
        case did.match(cheqdDidRegex)?.input:
          return await this.resolveDidDoc(agentContext, parsedDid.did)
        case did.match(cheqdDidVersionRegex)?.input: {
          const version = did.split('/')[2]
          return await this.resolveDidDoc(agentContext, parsedDid.did, version)
        }
        case did.match(cheqdDidVersionsRegex)?.input:
          return await this.resolveAllDidDocVersions(agentContext, parsedDid)
        case did.match(cheqdDidMetadataRegex)?.input:
          return await this.dereferenceCollectionResources(agentContext, parsedDid)
        case did.match(cheqdResourceMetadataRegex)?.input:
          return await this.dereferenceResourceMetadata(agentContext, parsedDid)
        default:
          return {
            didDocument: null,
            didDocumentMetadata,
            didResolutionMetadata: {
              error: 'Invalid request',
              message: `Unsupported did Url: '${did}'`,
            },
          }
      }
    } catch (error) {
      return {
        didDocument: null,
        didDocumentMetadata,
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did '${did}': ${error}`,
        },
      }
    }
  }

  public async resolveResource(agentContext: AgentContext, did: string) {
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)
    try {
      const parsedDid = parseCheqdDid(did)
      if (!parsedDid) {
        throw new Error('Invalid DID')
      }

      const { params, id } = parsedDid
      let found: ResourceWithMetadata | undefined
      if (did.match(cheqdResourceRegex)?.input) {
        found = await this.queryResource(cheqdLedgerService, parsedDid.did, id, did.split('/')[2])
      } else if (params?.resourceName && params.resourceType) {
        // Query parameters of a did url are percent-encoded. A name written before they were decoded may contain a literal
        // '%', so the decoded value is tried first and the literal one second.
        const names = uniqueValues([safeDecodeURIComponent(params.resourceName), params.resourceName])
        const types = uniqueValues([safeDecodeURIComponent(params.resourceType), params.resourceType])

        if (!params.version && !params.resourceVersionTime) {
          // The latest version, in one request. Listing the whole collection first gets slower the more versions it holds
          found = await this.queryLatestResource(cheqdLedgerService, parsedDid.did, id, names, types)
        } else {
          const { resources } = await cheqdLedgerService.resolveCollectionResources(parsedDid.did, id)
          const matching = resources.filter(
            (resource) => names.includes(resource.name) && types.includes(resource.resourceType)
          )
          if (!matching.length) {
            throw new Error('No resources found')
          }

          const resource = params.version
            ? matching.find((resource) => resource.version === params.version)
            : getClosestResourceVersion(matching, new Date(Number(params.resourceVersionTime) * 1000))
          if (!resource) {
            throw new Error('No resources found')
          }
          found = await this.queryResource(cheqdLedgerService, parsedDid.did, id, resource.id)
        }
      } else {
        return {
          error: 'notFound',
          message: `resolver_error: Invalid did url '${did}'`,
        }
      }

      const { resource, metadata } = found
      if (!resource || !metadata) {
        throw new Error('resolver_error: Unable to resolve resource, Please try again')
      }

      const result = await renderResourceData(resource.data, metadata.mediaType)
      return {
        resource: result,
        resourceMetadata: metadata,
        resourceResolutionMetadata: {},
      }
    } catch (error) {
      return {
        error: 'notFound',
        message: `resolver_error: Unable to resolve resource '${did}': ${error}`,
      }
    }
  }

  private async queryResource(
    cheqdLedgerService: CheqdLedgerService,
    did: string,
    collectionId: string,
    resourceId: string
  ) {
    if (!utils.isValidUuid(resourceId)) {
      throw new Error('Invalid resource Id')
    }
    return await cheqdLedgerService.resolveResource(did, collectionId, resourceId)
  }

  private async queryLatestResource(
    cheqdLedgerService: CheqdLedgerService,
    did: string,
    collectionId: string,
    names: string[],
    types: string[]
  ) {
    let lastError: unknown
    for (const name of names) {
      for (const type of types) {
        try {
          return await cheqdLedgerService.resolveLatestResource(did, collectionId, name, type)
        } catch (error) {
          lastError = error
        }
      }
    }
    throw lastError ?? new Error('No resources found')
  }

  private async resolveAllDidDocVersions(agentContext: AgentContext, parsedDid: ParsedCheqdDid) {
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)
    const { did } = parsedDid

    const { didDocumentVersionsMetadata } = await cheqdLedgerService.resolveMetadata(did)
    return {
      didDocument: new DidDocument({ id: did }),
      didDocumentMetadata: didDocumentVersionsMetadata,
      didResolutionMetadata: {},
    }
  }

  private async dereferenceCollectionResources(agentContext: AgentContext, parsedDid: ParsedCheqdDid) {
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)
    const { did, id } = parsedDid

    const metadata = await cheqdLedgerService.resolveCollectionResources(did, id)
    return {
      didDocument: new DidDocument({ id: did }),
      didDocumentMetadata: {
        linkedResourceMetadata: metadata,
      },
      didResolutionMetadata: {},
    }
  }

  private async dereferenceResourceMetadata(agentContext: AgentContext, parsedDid: ParsedCheqdDid) {
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)
    const { did, id } = parsedDid

    if (!parsedDid.path) {
      throw new CredoError(`Missing path in did ${parsedDid.did}`)
    }

    const [, , resourceId] = parsedDid.path.split('/')

    if (!resourceId) {
      throw new CredoError(`Missing resource id in didUrl ${parsedDid.didUrl}`)
    }

    const metadata = await cheqdLedgerService.resolveResourceMetadata(did, id, resourceId)
    return {
      didDocument: new DidDocument({ id: did }),
      didDocumentMetadata: {
        linkedResourceMetadata: metadata,
      },
      didResolutionMetadata: {},
    }
  }

  private async resolveDidDoc(agentContext: AgentContext, did: string, version?: string): Promise<DidResolutionResult> {
    const cheqdLedgerService = agentContext.dependencyManager.resolve(CheqdLedgerService)

    const { didDocument, didDocumentMetadata } = await cheqdLedgerService.resolve(did, version)
    const { resources } = await cheqdLedgerService.resolveCollectionResources(did, did.split(':')[3])
    didDocumentMetadata.linkedResourceMetadata = resources

    return {
      didDocument: JsonTransformer.fromJSON(didDocument, DidDocument),
      didDocumentMetadata,
      didResolutionMetadata: {},
    }
  }
}

function uniqueValues(values: string[]) {
  return [...new Set(values)]
}

function safeDecodeURIComponent(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
