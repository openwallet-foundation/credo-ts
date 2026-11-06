import {
  type AgentContext,
  type DidCreateOptions,
  type DidDeactivateOptions,
  type DidDocument,
  type DidDocumentKey,
  type DidUpdateOptions,
  injectable,
  Kms,
} from '@credo-ts/core'
import { Client } from '@hashgraph/sdk'
import { LRUMemoryCache } from '@hiero-did-sdk/cache'
import { HederaClientService, type HederaNetwork } from '@hiero-did-sdk/client'
import {
  type Cache,
  DID_ROOT_KEY_ID,
  type DIDResolution,
  parseDID,
  type Service,
  type VerificationMethod,
} from '@hiero-did-sdk/core'
import {
  type CreateDIDResult,
  type DeactivateDIDResult,
  DIDUpdateBuilder,
  generateCreateDIDRequest,
  generateDeactivateDIDRequest,
  generateUpdateDIDRequest,
  submitCreateDIDRequest,
  submitDeactivateDIDRequest,
  submitUpdateDIDRequest,
  type UpdateDIDResult,
} from '@hiero-did-sdk/registrar'
import { resolveDID, TopicReaderHederaHcs } from '@hiero-did-sdk/resolver'
import { HederaModuleConfig } from '../HederaModuleConfig'
import { KmsPublisher } from './publisher/KmsPublisher'
import { createOrGetKey, getMultibasePublicKey } from './utils'

export interface HederaDidCreateOptions extends DidCreateOptions {
  method: 'hedera'
  options?: {
    network?: HederaNetwork | string
  }
  secret?: {
    rootKeyId?: string
    keys?: DidDocumentKey[]
  }
}

export interface HederaCreateDidResult extends CreateDIDResult {
  rootKey: DidDocumentKey
}

export interface HederaDidUpdateOptions extends DidUpdateOptions {
  secret?: {
    keys?: DidDocumentKey[]
  }
}

export interface HederaDidDeactivateOptions extends DidDeactivateOptions {
  secret?: {
    keys?: DidDocumentKey[]
  }
}

@injectable()
export class HederaLedgerService {
  private readonly clientService: HederaClientService
  private readonly cache: Cache

  public constructor(private readonly config: HederaModuleConfig) {
    this.clientService = new HederaClientService(config.options)
    this.cache = this.config.options.cache ?? new LRUMemoryCache(50)
  }

  public async resolveDid(agentContext: AgentContext, did: string): Promise<DIDResolution> {
    const topicReader = this.getHederaHcsTopicReader(agentContext)
    return await resolveDID(did, 'application/ld+json;profile="https://w3id.org/did-resolution"', { topicReader })
  }

  public async createDid(agentContext: AgentContext, props: HederaDidCreateOptions): Promise<HederaCreateDidResult> {
    const { options, secret, didDocument } = props
    return this.clientService.withClient({ networkName: options?.network }, async (client: Client) => {
      const topicReader = this.getHederaHcsTopicReader(agentContext)

      const controller =
        typeof didDocument?.controller === 'string'
          ? didDocument?.controller
          : Array.isArray(didDocument?.controller)
            ? didDocument?.controller[0]
            : undefined

      const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

      const publicJwk = await createOrGetKey(kms, secret?.rootKeyId)
      const rootKey = { kmsKeyId: publicJwk.keyId, didDocumentRelativeKeyId: DID_ROOT_KEY_ID }

      const publisher = await this.getPublisher(agentContext, client, publicJwk.keyId)

      const { state, signingRequest } = await generateCreateDIDRequest(
        {
          controller,
          multibasePublicKey: getMultibasePublicKey(publicJwk),
          topicReader,
        },
        {
          client,
          publisher,
        }
      )

      const signatureResult = await kms.sign({
        keyId: publicJwk.keyId,
        data: signingRequest.serializedPayload,
        algorithm: 'EdDSA',
      })
      const createDidDocumentResult = await submitCreateDIDRequest(
        { state, signature: signatureResult.signature, topicReader },
        {
          client,
          publisher,
        }
      )

      if (didDocument) {
        const keys = [...(secret?.keys ?? []), ...[rootKey]]
        const updateDidDocumentResult = await this.updateDid(agentContext, {
          did: createDidDocumentResult.did,
          didDocumentOperation: 'setDidDocument',
          didDocument,
          options: { ...options },
          secret: { keys },
        })
        return {
          ...updateDidDocumentResult,
          rootKey,
        }
      }

      return {
        ...createDidDocumentResult,
        rootKey,
      }
    })
  }

  public async updateDid(agentContext: AgentContext, props: HederaDidUpdateOptions): Promise<UpdateDIDResult> {
    const { did, didDocumentOperation, didDocument, secret } = props
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    if (!didDocumentOperation) {
      throw new Error('DidDocumentOperation is required')
    }

    const rootKey = secret?.keys?.find((key) => key.didDocumentRelativeKeyId === DID_ROOT_KEY_ID)
    if (!rootKey?.kmsKeyId) {
      throw new Error('The root key not found in the KMS')
    }

    this.validateDidUpdateKeys(didDocument, secret?.keys ?? [])

    const { network: networkName } = parseDID(did)
    return this.clientService.withClient({ networkName }, async (client: Client) => {
      const topicReader = this.getHederaHcsTopicReader(agentContext)

      const currentDidDocumentResolution = await resolveDID(
        did,
        'application/ld+json;profile="https://w3id.org/did-resolution"',
        { topicReader }
      )
      if (!currentDidDocumentResolution.didDocument) {
        throw new Error(`DID ${did} not found`)
      }

      const didUpdates = this.prepareDidUpdates(
        currentDidDocumentResolution.didDocument,
        didDocument,
        didDocumentOperation
      )

      const publisher = await this.getPublisher(agentContext, client, rootKey.kmsKeyId)

      const { states, signingRequests } = await generateUpdateDIDRequest(
        {
          did,
          updates: didUpdates.build(),
          topicReader,
        },
        {
          client,
          publisher,
        }
      )

      const signatures = await this.signRequests(signingRequests, kms, rootKey.kmsKeyId)
      return await submitUpdateDIDRequest(
        {
          states,
          signatures,
          topicReader,
        },
        {
          client,
          publisher,
        }
      )
    })
  }

  public async deactivateDid(
    agentContext: AgentContext,
    props: HederaDidDeactivateOptions
  ): Promise<DeactivateDIDResult> {
    const { did, secret } = props

    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)

    const rootKey = secret?.keys?.find((key) => key.didDocumentRelativeKeyId === DID_ROOT_KEY_ID)
    if (!rootKey?.kmsKeyId) {
      throw new Error('The root key not found in the KMS')
    }

    const { network: networkName } = parseDID(props.did)
    return this.clientService.withClient({ networkName }, async (client: Client) => {
      const topicReader = this.getHederaHcsTopicReader(agentContext)

      const publisher = await this.getPublisher(agentContext, client, rootKey.kmsKeyId)

      const { state, signingRequest } = await generateDeactivateDIDRequest(
        {
          did,
          topicReader,
        },
        {
          client,
          publisher,
        }
      )
      const signatureResult = await kms.sign({
        keyId: rootKey.kmsKeyId,
        data: signingRequest.serializedPayload,
        algorithm: 'EdDSA',
      })
      return await submitDeactivateDIDRequest(
        {
          state,
          signature: signatureResult.signature,
          topicReader,
        },
        {
          client,
          publisher,
        }
      )
    })
  }

  private getHederaHcsTopicReader(_agentContext: AgentContext): TopicReaderHederaHcs {
    return new TopicReaderHederaHcs({ ...this.config.options, cache: this.cache })
  }

  private async getPublisher(agentContext: AgentContext, client: Client, keyId: string): Promise<KmsPublisher> {
    const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
    const publicJwk = await createOrGetKey(kms, keyId)
    return new KmsPublisher(agentContext, client, publicJwk)
  }

  private getDidDocumentEntryId(item: { id: string } | string): string {
    const id = typeof item === 'string' ? item : item.id
    return id.includes('#') ? `#${id.split('#').pop()}` : id
  }

  private getDidDocumentPropertyDiff(
    originalEntries: Array<string | { id: string }> = [],
    updatedEntries: Array<string | { id: string }> = []
  ) {
    const originalIds = new Set(originalEntries.map((item) => this.getDidDocumentEntryId(item)))
    const updatedIds = new Set(updatedEntries.map((item) => this.getDidDocumentEntryId(item)))

    const unchangedEntries = updatedEntries.filter((item) => originalIds.has(this.getDidDocumentEntryId(item)))
    const newEntries = updatedEntries.filter((item) => !originalIds.has(this.getDidDocumentEntryId(item)))
    const removedEntries = originalEntries.filter((item) => !updatedIds.has(this.getDidDocumentEntryId(item)))

    return { unchangedEntries, newEntries, removedEntries }
  }

  private async signRequests(
    signingRequests: Record<string, { serializedPayload: Uint8Array }>,
    kms: Kms.KeyManagementApi,
    keyId: string
  ): Promise<Record<string, Uint8Array>> {
    const result: Record<string, Uint8Array> = {}

    for (const [key, request] of Object.entries(signingRequests)) {
      const { signature } = await kms.sign({
        keyId,
        data: request.serializedPayload,
        algorithm: 'EdDSA',
      })
      result[key] = signature
    }

    return result
  }

  private validateDidUpdateKeys(didDocument: DidDocument | Partial<DidDocument>, keys: DidDocumentKey[]) {
    const verificationRelationships = [
      'verificationMethod',
      'assertionMethod',
      'authentication',
      'capabilityDelegation',
      'capabilityInvocation',
      'keyAgreement',
    ] as const

    for (const relationship of verificationRelationships) {
      const entries = didDocument[relationship]
      if (!entries) continue

      for (const entry of entries) {
        const id = this.getDidDocumentEntryId(entry)
        if (!keys.some((key) => key.didDocumentRelativeKeyId === id)) {
          throw new Error(
            `Key ${id} is present in updated DID Document, but missing from DID record keys and DID update arguments`
          )
        }
      }
    }
  }

  private prepareDidUpdates(
    originalDocument: DidDocument | Partial<DidDocument>,
    newDocument: DidDocument | Partial<DidDocument>,
    operation: string
  ): DIDUpdateBuilder {
    const builder = new DIDUpdateBuilder()
    const properties = [
      'service',
      'verificationMethod',
      'assertionMethod',
      'authentication',
      'capabilityDelegation',
      'capabilityInvocation',
      'keyAgreement',
    ] as const

    for (const property of properties) {
      const { unchangedEntries, newEntries, removedEntries } = this.getDidDocumentPropertyDiff(
        originalDocument[property],
        newDocument[property]
      )

      if (operation === 'setDidDocument') {
        for (const entry of removedEntries) {
          const entryId = this.getDidDocumentEntryId(entry)
          if (entryId === DID_ROOT_KEY_ID) continue
          const builderMethod = this.getUpdateMethod(builder, property, 'remove')
          builderMethod(entryId)
        }

        for (const entry of newEntries) {
          if (this.getDidDocumentEntryId(entry) === DID_ROOT_KEY_ID) continue
          const builderMethod = this.getUpdateMethod(builder, property, 'add')
          builderMethod(entry)
        }
      }

      if (operation === 'addToDidDocument') {
        for (const entry of newEntries) {
          if (this.getDidDocumentEntryId(entry) === DID_ROOT_KEY_ID) continue
          const builderMethod = this.getUpdateMethod(builder, property, 'add')
          builderMethod(entry)
        }
      }

      if (operation === 'removeFromDidDocument') {
        for (const entry of unchangedEntries) {
          const entryId = this.getDidDocumentEntryId(entry)
          if (entryId === DID_ROOT_KEY_ID) continue
          const builderMethod = this.getUpdateMethod(builder, property, 'remove')
          builderMethod(entryId)
        }
      }
    }

    return builder
  }

  private getUpdateMethod(
    builder: DIDUpdateBuilder,
    property: string,
    action: 'add' | 'remove'
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
  ): (item: any) => DIDUpdateBuilder {
    // biome-ignore lint/suspicious/noExplicitAny: no explanation
    const methodMap: Record<string, Record<'add' | 'remove', (item: any) => DIDUpdateBuilder>> = {
      service: {
        add: (item: Service) => builder.addService(item),
        remove: (id: string) => builder.removeService(id),
      },
      verificationMethod: {
        add: (item: VerificationMethod | string) => builder.addVerificationMethod(item),
        remove: (id: string) => builder.removeVerificationMethod(id),
      },
      assertionMethod: {
        add: (item: VerificationMethod | string) => builder.addAssertionMethod(item),
        remove: (id: string) => builder.removeAssertionMethod(id),
      },
      authentication: {
        add: (item: VerificationMethod | string) => builder.addAuthenticationMethod(item),
        remove: (id: string) => builder.removeAuthenticationMethod(id),
      },
      capabilityDelegation: {
        add: (item: VerificationMethod | string) => builder.addCapabilityDelegationMethod(item),
        remove: (id: string) => builder.removeCapabilityDelegationMethod(id),
      },
      capabilityInvocation: {
        add: (item: VerificationMethod | string) => builder.addCapabilityInvocationMethod(item),
        remove: (id: string) => builder.removeCapabilityInvocationMethod(id),
      },
      keyAgreement: {
        add: (item: VerificationMethod | string) => builder.addKeyAgreementMethod(item),
        remove: (id: string) => builder.removeKeyAgreementMethod(id),
      },
    }

    const propertyMethods = methodMap[property]
    if (!propertyMethods) {
      return () => builder
    }

    return propertyMethods[action]
  }
}
