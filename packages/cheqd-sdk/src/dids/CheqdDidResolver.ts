import type { ParsedCheqdDid } from '../anoncreds/utils/identifiers'
import type { AgentContext, DidDocument, DidResolutionResult, DidResolver, ParsedDid } from '@aries-framework/core'
import type { Metadata } from '@cheqd/ts-proto/cheqd/resource/v2'

import { JsonEncoder } from '@aries-framework/core'
import { toString } from 'uint8arrays'

import {
  cheqdDidMetadataRegex,
  cheqdDidRegex,
  cheqdDidVersionRegex,
  cheqdDidVersionsRegex,
  cheqdResourceMetadataRegex,
  cheqdResourceRegex,
  parseCheqdDid,
} from '../anoncreds/utils/identifiers'
import { CheqdSdkLedgerService } from '../ledger'

export class CheqdDidResolver implements DidResolver {
  public readonly supportedMethods = ['cheqd']

  public async resolve(agentContext: AgentContext, did: string, parsed: ParsedDid): Promise<DidResolutionResult> {
    const didDocumentMetadata = {}

    try {
      const parsedDid = parseCheqdDid(parsed.didUrl)
      if (!parsedDid) {
        throw new Error('Invalid DID')
      }

      switch (did) {
        case did.match(cheqdDidRegex)?.input:
          return await this.Resolve(agentContext, parsedDid.did)
        case did.match(cheqdDidVersionRegex)?.input: {
          const version = did.match(cheqdDidVersionRegex)![7]
          return await this.Resolve(agentContext, parsedDid.did, version)
        }
        case did.match(cheqdDidVersionsRegex)?.input:
          return await this.ResolveAllDidDocVersions(agentContext, parsedDid)
        case did.match(cheqdDidMetadataRegex)?.input:
          return await this.DereferenceCollectionResources(agentContext, parsedDid)
        case did.match(cheqdResourceMetadataRegex)?.input:
          return await this.DereferenceResourceMetadata(agentContext, parsedDid)
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

  public async resolveResource(agentContext: AgentContext, did: string): Promise<any> {
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)
    try {
      const parsedDid = parseCheqdDid(did)
      if (!parsedDid) {
        throw new Error('Invalid DID')
      }

      const { id, params, network } = parsedDid
      await cheqdSdkLedgerService.connect({ network })

      let resourceId: string
      if (did.match(cheqdResourceRegex)?.input) {
        resourceId = did.split('/')[2]
      } else if (params && params.resourceName && params.resourceType) {
        let resources = (await cheqdSdkLedgerService.resolveCollectionResources(id)).resources
        resources = resources.filter(
          (resource) => resource.name == params.resourceName && resource.resourceType == params.resourceType
        )
        if (!resources.length) {
          throw new Error(`No resources found`)
        }

        let resource: Metadata | undefined
        if (params.version) {
          resource = resources.find((resource) => resource.version == params.version)
        } else {
          const date = params.time ? new Date(params.time) : new Date()
          // find the resourceId to the created time
          resources.sort(function (a, b) {
            const distancea = Math.abs(date.getTime() - a.created!.getTime())
            const distanceb = Math.abs(date.getTime() - b.created!.getTime())
            return distancea - distanceb
          })
          resource = resources[0]
        }

        if (!resource) {
          throw new Error(`No resources found`)
        }

        resourceId = resource.id
      } else {
        return {
          error: 'notFound',
          message: `resolver_error: Invalid did url '${did}'`,
        }
      }

      const { resource, metadata } = await cheqdSdkLedgerService.resolveResource(id, resourceId)
      if (!resource || !metadata) {
        throw new Error('Please try again, Internal error')
      }

      const mimeType = metadata.mediaType
      let result: any
      if (mimeType == 'application/json') {
        result = await JsonEncoder.fromBuffer(resource.data)
      } else if (mimeType == 'text/plain') {
        result = toString(resource.data)
      } else {
        result = toString(resource.data, 'base64')
      }

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

  private async ResolveAllDidDocVersions(agentContext: AgentContext, parsedDid: ParsedCheqdDid) {
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)
    const { did, network } = parsedDid

    await cheqdSdkLedgerService.connect({ network })
    const { didDocumentVersionsMetadata } = await cheqdSdkLedgerService.resolveMetadata(did)
    return {
      didDocument: { id: did } as DidDocument,
      didDocumentMetadata: didDocumentVersionsMetadata,
      didResolutionMetadata: {},
    }
  }

  private async DereferenceCollectionResources(agentContext: AgentContext, parsedDid: ParsedCheqdDid) {
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)
    const { did, network } = parsedDid

    await cheqdSdkLedgerService.connect({ network })
    const metadata = await cheqdSdkLedgerService.resolveCollectionResources(did)
    return {
      didDocument: { id: did } as DidDocument,
      didDocumentMetadata: {
        linkedResourceMetadata: metadata,
      },
      didResolutionMetadata: {},
    }
  }

  private async DereferenceResourceMetadata(agentContext: AgentContext, parsedDid: ParsedCheqdDid) {
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)
    const { did, network } = parsedDid

    const resourceId = parsedDid.path!.split('/')[2]

    await cheqdSdkLedgerService.connect({ network })
    const metadata = await cheqdSdkLedgerService.resolveResourceMetadata(did, resourceId)
    return {
      didDocument: { id: did } as DidDocument,
      didDocumentMetadata: {
        linkedResourceMetadata: metadata,
      },
      didResolutionMetadata: {},
    }
  }

  private async Resolve(agentContext: AgentContext, did: string, version?: string): Promise<DidResolutionResult> {
    const cheqdSdkLedgerService = agentContext.dependencyManager.resolve(CheqdSdkLedgerService)

    await cheqdSdkLedgerService.connect({ network: did.split(':')[2] })
    const { didDocument, didDocumentMetadata } = await cheqdSdkLedgerService.resolve(did, version)
    const { resources } = await cheqdSdkLedgerService.resolveCollectionResources(did)
    didDocumentMetadata.linkedResourceMetadata = resources

    return {
      didDocument: didDocument as DidDocument,
      didDocumentMetadata,
      didResolutionMetadata: {},
    }
  }
}
