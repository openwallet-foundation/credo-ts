import type {
  AnonCredsCredentialDefinition,
  AnonCredsRegistry,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationRegistryDefinitionValue,
  AnonCredsRevocationStatusList,
  AnonCredsRevocationStatusListWithoutTimestamp,
  AnonCredsSchema,
  GetCredentialDefinitionReturn,
  GetRevocationRegistryDefinitionReturn,
  GetRevocationStatusListReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionOptions,
  RegisterCredentialDefinitionReturn,
  RegisterRevocationRegistryDefinitionOptions,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListOptions,
  RegisterRevocationStatusListReturn,
  RegisterSchemaOptions,
  RegisterSchemaReturn,
} from '@credo-ts/anoncreds'

import {
  type AgentContext,
  CredoError,
  DidRepository,
  JsonTransformer,
  MultiBaseEncoder,
  MultiHashEncoder,
  type Proof,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { canonicalize } from 'json-canonicalize'
import { EddsaJcs2022Cryptosuite, type UnsecuredDocument } from '../../cryptosuites'
import { WebVhDidResolver } from '../../dids'
import { isWebVhAttestedResource, parseResourceId, WebVhAttestedResource } from '../../resources'
import { WebVhAnonCredsResource } from '../utils/transform'

type DidResourceResolutionResult = {
  error?: string
  message?: string
  content?: Record<string, unknown> | unknown[] | string // More specific than any, but still flexible
  contentMetadata?: Record<string, unknown>
  dereferencingMetadata?: Record<string, unknown>
}

type SchemaContentShape = {
  attrNames: string[]
  name: string
  version: string
  issuerId: string
}

type CredentialDefinitionContentShape = {
  issuerId: string
  schemaId: string
  type: string
  tag: string
  value: Record<string, unknown>
}

type RevocationRegistryDefinitionContentShape = {
  issuerId: string
  revocDefType: string
  credDefId: string
  tag: string
  value: RevocationRegistryDefinitionValueShape
}

type RevocationRegistryDefinitionValueShape = {
  publicKeys: {
    accumKey: {
      z: string
    }
  }
  maxCredNum: number
  tailsLocation: string
  tailsHash: string
}

type RevocationStatusListShape = {
  issuerId: string
  revRegDefId: string
  revocationList: number[]
  currentAccumulator: string
  timestamp: number
}

function isSchemaContentShape(value: unknown): value is SchemaContentShape {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    Array.isArray(candidate.attrNames) &&
    candidate.attrNames.every((item) => typeof item === 'string') &&
    typeof candidate.name === 'string' &&
    typeof candidate.version === 'string' &&
    typeof candidate.issuerId === 'string'
  )
}

function isCredentialDefinitionContentShape(
  value: unknown
): value is CredentialDefinitionContentShape {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.issuerId === 'string' &&
    typeof candidate.schemaId === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.tag === 'string' &&
    !!candidate.value &&
    typeof candidate.value === 'object'
  )
}

function isRevocationRegistryDefinitionContentShape(
  value: unknown
): value is RevocationRegistryDefinitionContentShape {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.issuerId === 'string' &&
    typeof candidate.revocDefType === 'string' &&
    typeof candidate.credDefId === 'string' &&
    typeof candidate.tag === 'string' &&
    isRevocationRegistryDefinitionValueShape(candidate.value)
  )
}

function isRevocationRegistryDefinitionValueShape(
  value: unknown
): value is RevocationRegistryDefinitionValueShape {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  const publicKeys = candidate.publicKeys as Record<string, unknown> | undefined
  const accumKey = publicKeys?.accumKey as Record<string, unknown> | undefined

  return (
    !!publicKeys &&
    typeof publicKeys === 'object' &&
    !!accumKey &&
    typeof accumKey === 'object' &&
    typeof accumKey.z === 'string' &&
    typeof candidate.maxCredNum === 'number' &&
    typeof candidate.tailsLocation === 'string' &&
    typeof candidate.tailsHash === 'string'
  )
}

function isRevocationStatusListShape(value: unknown): value is RevocationStatusListShape {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.issuerId === 'string' &&
    typeof candidate.revRegDefId === 'string' &&
    Array.isArray(candidate.revocationList) &&
    candidate.revocationList.every((item) => typeof item === 'number') &&
    typeof candidate.currentAccumulator === 'string' &&
    typeof candidate.timestamp === 'number'
  )
}

export class WebVhAnonCredsRegistry implements AnonCredsRegistry {
  public methodName = 'webvh'

  public allowsCaching = true
  public allowsLocalRecord = true

  /**
   * This class supports resolving objects with did:webvh identifiers.
   */
  public readonly supportedIdentifier = /^did:webvh:.*/

  /**
   * Resolves a resource using the WebVhDidResolver and performs common validation steps.
   *
   * @param agentContext The agent context.
   * @param resourceId The DID URI of the resource to resolve.
  * @param resourceTypeString A descriptive string for the resource type (e.g., 'schema', 'credential definition') used in logs/errors.
  * @returns The parsed and validated resource object and the original resolution result.
   * @throws {CredoError} If resolution, parsing, or validation fails.
   */
  private _digestMultibase(value: string) {
    const valueBytes = TypedArrayEncoder.fromUtf8String(value)
    const digestMultihash = MultiHashEncoder.encode(valueBytes, 'sha-256')
    const digestMultibase = MultiBaseEncoder.encode(digestMultihash, 'base58btc')
    return digestMultibase
  }
  private async _resolveAndValidateAttestedResource(
    agentContext: AgentContext,
    resourceId: string,
    resourceTypeString: string
  ): Promise<{ resourceObject: WebVhAttestedResource; resolutionResult: DidResourceResolutionResult }> {
    try {
      const webvhDidResolver = agentContext.dependencyManager.resolve(WebVhDidResolver)
      if (!this.supportedIdentifier.test(resourceId))
        throw new CredoError(`Invalid ${resourceTypeString} ID: ${resourceId}`)

      agentContext.config.logger.trace(
        `Attempting to resolve ${resourceTypeString} resource '${resourceId}' via did:webvh resolver`
      )

      const resolutionResult = await webvhDidResolver.resolveResource(agentContext, resourceId)

      if (!resolutionResult) {
        throw new CredoError(`Resource resolution returned null/undefined for ${resourceId}`)
      }

      if ('error' in resolutionResult || !('content' in resolutionResult)) {
        throw new CredoError(
          `Resource ${resourceId} could not be resolved or is missing data. Error: ${resolutionResult.error || 'unknown'} - ${resolutionResult.message || 'no message'}`
        )
      }

      let resourceObject: WebVhAnonCredsResource
      try {
        agentContext.config.logger.trace(
          `Parsing resource data: ${JSON.stringify(resolutionResult.content).substring(0, 200)}...`
        )
        resourceObject = JsonTransformer.fromJSON(resolutionResult.content, WebVhAnonCredsResource)
      } catch (parseError) {
        agentContext.config.logger.error(`Failed to parse resource data for ${resourceId}`, {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          stack: parseError instanceof Error ? parseError.stack : undefined,
        })
        throw new CredoError(
          `Failed to parse resource data for ${resourceId}: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`
        )
      }

      // --- Attested Resource Validation steps ---

      // 1. Data Model Verification
      if (!isWebVhAttestedResource(resourceObject)) {
        throw new CredoError('Missing AttestedResource type.')
      }
      agentContext.config.logger.trace(`Resource ${resourceId} attestation found.`)

      // 2. DataIntegrityProof Verification
      const verified = await this.verifyProof(agentContext, resourceObject)
      if (!verified) {
        agentContext.config.logger.trace('Resolved resource proof is invalid.')
        throw new CredoError('Resolved resource proof is invalid.')
      }
      agentContext.config.logger.trace(`Resource ${resourceId} proof validated.`)

      // 3. Resource Digest Multibase Verification
      if (resourceObject.id !== resourceId) {
        throw new CredoError(`ID mismatch ${resourceObject.id} != ${resourceId}`)
      }
      const parts = resourceId.split(/[:/]/)
      const expectedMultibaseHash = parts[parts.length - 1]
      if (!expectedMultibaseHash) {
        throw new CredoError(`Could not extract expected hash from ${resourceTypeString} ID: ${resourceId}`)
      }
      const digestMultibase = this._digestMultibase(canonicalize(resourceObject.content))

      if (digestMultibase !== expectedMultibaseHash) {
        throw new CredoError(
          `Content hash mismatch for ${resourceId}. Expected: ${expectedMultibaseHash}, Actual: ${digestMultibase}`
        )
      }
      agentContext.config.logger.trace(`Resource ${resourceId} content hash matches filename.`)

      return { resourceObject, resolutionResult }
    } catch (error) {
      agentContext.config.logger.error('Error in did:webvh _resolveAndValidateAttestedResource:', error)
      throw error
    }
  }

  public async getSchema(agentContext: AgentContext, schemaId: string): Promise<GetSchemaReturn> {
    try {
      const { resourceObject, resolutionResult } = await this._resolveAndValidateAttestedResource(
        agentContext,
        schemaId,
        'schema'
      )

      // --- Parsing Step (Simplified) ---
      const schemaContent = resourceObject.content

      // Type check to ensure we have a schema content object
      if (!isSchemaContentShape(schemaContent)) {
        throw new CredoError(`Parsed resource content for ${schemaId} is not a valid schema.`)
      }

      const contentIssuerId = schemaContent.issuerId

      const parsedSchemaId = parseResourceId(schemaId)
      if (!parsedSchemaId) {
        throw new CredoError(`Could not extract DID from resource ID: ${schemaId}`)
      }
      const expectedIssuerDid = parsedSchemaId.did

      if (contentIssuerId !== expectedIssuerDid) {
        throw new CredoError(
          `Issuer ID mismatch for ${schemaId}. Expected: ${expectedIssuerDid}, Actual: ${contentIssuerId}`
        )
      }

      return {
        schema: {
          attrNames: schemaContent.attrNames,
          name: schemaContent.name,
          version: schemaContent.version,
          issuerId: contentIssuerId,
        },
        schemaId,
        resolutionMetadata: resolutionResult.dereferencingMetadata || {},
        schemaMetadata: resourceObject.metadata || {},
      }
    } catch (error) {
      agentContext.config.logger.error(`Error retrieving schema '${schemaId}' via did:webvh`, {
        error: error instanceof Error ? error.message : String(error),
        schemaId,
      })

      return {
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: `unable to resolve schema: ${error instanceof Error ? error.message : String(error)}`,
        },
        schemaMetadata: {},
      }
    }
  }

  public async getCredentialDefinition(
    agentContext: AgentContext,
    credentialDefinitionId: string
  ): Promise<GetCredentialDefinitionReturn> {
    try {
      const { resourceObject, resolutionResult } = await this._resolveAndValidateAttestedResource(
        agentContext,
        credentialDefinitionId,
        'credential definition'
      )

      // Extract the content and make sure it's a CredDef
      const credDefContent = resourceObject.content
      // Type check for WebVhCredDefContent
      if (!isCredentialDefinitionContentShape(credDefContent)) {
        throw new CredoError('Resolved resource content is not a valid credential definition.')
      }

      const contentIssuerId = credDefContent.issuerId

      // Extract the DID from the resourceId (part before /resources/hash)
      const parsedCredentialDefinitionId = parseResourceId(credentialDefinitionId)
      if (!parsedCredentialDefinitionId) {
        throw new CredoError(`Could not extract DID from resource ID: ${credentialDefinitionId}`)
      }
      const expectedIssuerDid = parsedCredentialDefinitionId.did

      if (contentIssuerId !== expectedIssuerDid) {
        throw new CredoError(
          `Issuer ID mismatch for ${credentialDefinitionId}. Expected: ${expectedIssuerDid}, Actual: ${contentIssuerId}`
        )
      }

      // Extract metadata from the resolved resource
      const credDefMetadata = resourceObject.metadata || resolutionResult.contentMetadata || {}

      return {
        credentialDefinition: {
          issuerId: credDefContent.issuerId,
          schemaId: credDefContent.schemaId,
          type: 'CL' as const, // Assuming CL type for now, might need adjustment if other types are supported
          tag: credDefContent.tag,
          value: credDefContent.value as { primary: Record<string, unknown>; revocation?: unknown }, // Assuming structure
        },
        credentialDefinitionId,
        resolutionMetadata: resolutionResult.dereferencingMetadata || {},
        credentialDefinitionMetadata: credDefMetadata,
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving credential definition '${credentialDefinitionId}' via did:webvh`,
        {
          error: error instanceof Error ? error.message : String(error),
          credentialDefinitionId,
        }
      )

      return {
        credentialDefinitionId,
        resolutionMetadata: {
          error: 'invalid',
          message: `unable to resolve credential definition: ${error instanceof Error ? error.message : String(error)}`,
        },
        credentialDefinitionMetadata: {},
      }
    }
  }

  public async getRevocationRegistryDefinition(
    agentContext: AgentContext,
    revocationRegistryDefinitionId: string
  ): Promise<GetRevocationRegistryDefinitionReturn> {
    try {
      const { resourceObject, resolutionResult } = await this._resolveAndValidateAttestedResource(
        agentContext,
        revocationRegistryDefinitionId,
        'revocation registry definition'
      )

      const revRegDefContent = resourceObject.content

      if (!isRevocationRegistryDefinitionContentShape(revRegDefContent)) {
        throw new CredoError(
          `Parsed resource content for ${revocationRegistryDefinitionId} is not a valid revocation registry definition.`
        )
      }

      // Extract metadata
      const revRegDefMetadata = resourceObject.metadata || resolutionResult.contentMetadata || {}

      return {
        revocationRegistryDefinition: {
          issuerId: revRegDefContent.issuerId,
          revocDefType: revRegDefContent.revocDefType as AnonCredsRevocationRegistryDefinition['revocDefType'], // TODO: Map revocDefType string to AnonCreds type
          credDefId: revRegDefContent.credDefId,
          tag: revRegDefContent.tag,
          value: revRegDefContent.value as AnonCredsRevocationRegistryDefinitionValue,
        },
        revocationRegistryDefinitionId,
        resolutionMetadata: resolutionResult.dereferencingMetadata || {},
        revocationRegistryDefinitionMetadata: revRegDefMetadata,
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry definition '${revocationRegistryDefinitionId}' via did:webvh`,
        {
          error: error instanceof Error ? error.message : String(error),
          revocationRegistryDefinitionId,
        }
      )

      return {
        revocationRegistryDefinitionId,
        resolutionMetadata: {
          error: 'invalid',
          message: `unable to resolve revocation registry definition: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
        revocationRegistryDefinitionMetadata: {},
      }
    }
  }

  public async getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number
  ): Promise<GetRevocationStatusListReturn> {
    try {
      if (!revocationRegistryId.startsWith('did:webvh:'))
        throw new CredoError(`Invalid revocationRegistryId: ${revocationRegistryId}`)

      agentContext.config.logger.trace(
        `Attempting to resolve revocation status list resource for '${revocationRegistryId}' at timestamp ${timestamp} via did:webvh resolver`
      )
      const { resourceObject } = await this._resolveAndValidateAttestedResource(
        agentContext,
        revocationRegistryId,
        'revocation status list'
      )
      if (!resourceObject.links) {
        throw new CredoError('No revocation entries found.')
      }

      const revocationEntries = resourceObject.links
        .filter((entry) => entry.timestamp != null)
        .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
      if (!revocationEntries || revocationEntries.length === 0) {
        throw new CredoError('No revocation entries found.')
      }

      let revocationEntryId: string | undefined
      for (const [index, entry] of revocationEntries?.entries() ?? []) {
        if (entry.timestamp && entry.timestamp > timestamp) {
          revocationEntryId = revocationEntries?.[index - 1]?.id
          break
        }
      }
      if (!revocationEntryId) {
        revocationEntryId = revocationEntries?.[revocationEntries.length - 1]?.id
      }

      const { resourceObject: revocationEntryResourceObject, resolutionResult: revocationEntryResolutionResult } =
        await this._resolveAndValidateAttestedResource(agentContext, revocationEntryId, 'revocation status list entry')

      if (!revocationEntryResourceObject) {
        throw new CredoError('No revocation entry found for the given timestamp.')
      }

      if (!isRevocationStatusListShape(revocationEntryResourceObject.content)) {
        throw new CredoError('Resolved revocation entry content is not a valid revocation status list.')
      }

      return {
        revocationStatusList: revocationEntryResourceObject.content as AnonCredsRevocationStatusList,
        resolutionMetadata: revocationEntryResolutionResult.dereferencingMetadata || {},
        revocationStatusListMetadata: revocationEntryResourceObject.metadata || {},
      }
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry status list '${revocationRegistryId}' via did:webvh`,
        {
          error: error instanceof Error ? error.message : String(error),
          revocationRegistryId,
          timestamp,
        }
      )

      return {
        resolutionMetadata: {
          error: 'notFound',
          message: `unable to resolve revocation registry status list: ${error.message}`,
        },
        revocationStatusListMetadata: {},
      }
    }
  }

  public async registerSchema(
    agentContext: AgentContext,
    options?: WebVhRegisterSchemaOptions
  ): Promise<RegisterSchemaReturn> {
    if (!options?.schema) throw new CredoError('Schema options must be provided.')

    const resourceId = this._digestMultibase(canonicalize(options.schema))
    const schemaId = `${options.schema.issuerId}/resources/${resourceId}`

    const attestedResource = await this.buildSignedResource(agentContext, {
      content: options.schema,
      id: schemaId,
      metadata: {
        resourceId,
        resourceType: 'anonCredsSchema',
        resourceName: options.schema.name,
        ...options.options?.extraMetadata,
      },
      issuerId: options.schema.issuerId,
      verificationMethod: options?.options?.verificationMethod,
    })

    return {
      schemaState: { state: 'finished', schema: options.schema, schemaId },
      registrationMetadata: { attestedResource },
      schemaMetadata: {},
    }
  }

  public async registerCredentialDefinition(
    agentContext: AgentContext,
    options?: WebVhRegisterCredentialDefinitionOptions
  ): Promise<RegisterCredentialDefinitionReturn> {
    if (!options?.credentialDefinition) throw new CredoError('credentialDefinition options must be provided.')

    const resourceId = this._digestMultibase(canonicalize(options.credentialDefinition))

    const credentialDefinitionId = `${options.credentialDefinition.issuerId}/resources/${resourceId}`

    const attestedResource = await this.buildSignedResource(agentContext, {
      content: options.credentialDefinition,
      id: credentialDefinitionId,
      metadata: {
        resourceId,
        resourceType: 'anonCredsCredDef',
        resourceName: options.credentialDefinition.tag,
        ...options.options?.extraMetadata,
      },
      issuerId: options.credentialDefinition.issuerId,
      verificationMethod: options.options?.verificationMethod,
    })

    return {
      credentialDefinitionState: {
        state: 'finished',
        credentialDefinition: options.credentialDefinition,
        credentialDefinitionId,
      },
      credentialDefinitionMetadata: {},
      registrationMetadata: { attestedResource },
    }
  }

  public async registerRevocationRegistryDefinition(
    agentContext: AgentContext,
    options?: WebVhRegisterRevocationRegistryDefinitionOptions
  ): Promise<RegisterRevocationRegistryDefinitionReturn> {
    if (!options?.revocationRegistryDefinition)
      throw new CredoError('revocationRegistryDefinition options must be provided.')

    const resourceId = this._digestMultibase(canonicalize(options.revocationRegistryDefinition))

    const revocationRegistryDefinitionId = `${options.revocationRegistryDefinition.issuerId}/resources/${resourceId}`

    const attestedResource = await this.buildSignedResource(agentContext, {
      content: options.revocationRegistryDefinition,
      id: revocationRegistryDefinitionId,
      metadata: {
        resourceId,
        resourceType: 'anonCredsRevocRegDef',
        resourceName: options.revocationRegistryDefinition.tag,
        ...options.options?.extraMetadata,
      },
      issuerId: options.revocationRegistryDefinition.issuerId,
      verificationMethod: options.options?.verificationMethod,
    })

    return {
      revocationRegistryDefinitionState: {
        state: 'finished',
        revocationRegistryDefinition: options.revocationRegistryDefinition,
        revocationRegistryDefinitionId,
      },
      registrationMetadata: { attestedResource },
      revocationRegistryDefinitionMetadata: {},
    }
  }

  public async updateRevocationRegistryDefinition(
    agentContext: AgentContext,
    registrationMetadata: { proof?: Proof } & Record<string, object>,
    extraInfo: Record<string, object>
  ) {
    const { proof, ...restMetadata } = registrationMetadata

    const vm = proof?.verificationMethod
    if (!vm) throw new Error('verificationMethod not found in proof')
    const verificationMethod = typeof vm === 'string' ? vm : vm.id

    const updatedMetadata = { ...restMetadata, ...extraInfo }

    const newProof = await this.createProof(agentContext, updatedMetadata, verificationMethod)

    return {
      registrationMetadata: {
        ...updatedMetadata,
        proof: newProof,
      },
    }
  }

  public async registerRevocationStatusList(
    agentContext: AgentContext,
    options?: WebVhRegisterRevocationStatusListOptions
  ): Promise<RegisterRevocationStatusListReturn> {
    if (!options?.revocationStatusList) throw new CredoError('revocationStatusList options must be provided.')

    const timestamp = Math.floor(Date.now() / 1000)
    const resourceId = this._digestMultibase(canonicalize(options.revocationStatusList))

    const resourceStatusListId = `${options.revocationStatusList.issuerId}/resources/${resourceId}`

    const attestedResource = await this.buildSignedResource(agentContext, {
      content: options.revocationStatusList,
      id: resourceStatusListId,
      metadata: {
        resourceId,
        resourceType: 'anonCredsStatusList',
        resourceName: '0',
        ...options.options?.extraMetadata,
      },
      issuerId: options.revocationStatusList.issuerId,
      verificationMethod: options?.options?.verificationMethod,
    })

    return {
      revocationStatusListState: {
        state: 'finished',
        revocationStatusList: { ...options.revocationStatusList, timestamp },
      },
      registrationMetadata: { attestedResource },
      revocationStatusListMetadata: {
        previousVersionId: '',
        nextVersionId: '',
      },
    }
  }

  public async verifyProof(agentContext: AgentContext, attestedResource: WebVhAttestedResource): Promise<boolean> {
    const cryptosuite = new EddsaJcs2022Cryptosuite(agentContext)
    try {
      const verificationResult = await cryptosuite.verifyProof(attestedResource)
      return verificationResult.verified
    } catch (error) {
      agentContext.config.logger.error('Error during proof validation of did:webvh resource', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return false
    }
  }

  public async createProof(
    agentContext: AgentContext,
    unsecuredDocument: UnsecuredDocument,
    verificationMethod: string
  ) {
    const cryptosuite = new EddsaJcs2022Cryptosuite(agentContext)
    try {
      const creationResult = await cryptosuite.createProof(unsecuredDocument, {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod,
        proofPurpose: 'assertionMethod',
      })
      return creationResult
    } catch (error) {
      agentContext.config.logger.error('Error during proof creation of did:webvh resource', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    }
  }

  private async buildSignedResource(
    agentContext: AgentContext,
    {
      content,
      id,
      metadata,
      issuerId,
      verificationMethod,
    }: {
      content:
        | AnonCredsSchema
        | AnonCredsCredentialDefinition
        | AnonCredsRevocationRegistryDefinition
        | AnonCredsRevocationStatusListWithoutTimestamp
      id: string
      metadata: Record<string, unknown>
      issuerId: string
      verificationMethod?: string
    }
  ) {
    const verificationMethodId = await this.getVerificationMethodId(agentContext, issuerId, verificationMethod)

    // Prepare the generic resource payload to be signed
    const resourcePayload = {
      '@context': [
        'https://identity.foundation/did-attested-resources/context/v0.1',
        'https://w3id.org/security/data-integrity/v2',
      ],
      type: ['AttestedResource'],
      id,
      content,
      metadata,
    }

    const proof = await this.createProof(agentContext, resourcePayload, verificationMethodId)
    return {
      ...resourcePayload,
      proof,
    }
  }

  private async getVerificationMethodId(
    agentContext: AgentContext,
    issuerId: string,
    explicitVerificationMethod?: string
  ): Promise<string> {
    const didRepository = agentContext.dependencyManager.resolve(DidRepository)

    const didRecord = await didRepository.findCreatedDid(agentContext, issuerId)
    if (!didRecord) {
      throw new CredoError(`No DID found for issuer ${issuerId}`)
    }

    // Use the explicit verification method if provided, otherwise use the first available with publicKeyMultibase
    const verificationMethod =
      explicitVerificationMethod ??
      (didRecord.didDocument?.verificationMethod?.[0]?.publicKeyMultibase
        ? didRecord.didDocument.verificationMethod[0].id
        : undefined)

    if (!verificationMethod) {
      throw new CredoError(`No verification method found for DID ${didRecord.id}`)
    }
    return verificationMethod
  }
}

export type WebVhRegisterSchemaOptions = Omit<RegisterSchemaOptions, 'options'> & {
  options?: {
    verificationMethod?: string
    extraMetadata?: Record<string, unknown>
  }
}

export type WebVhRegisterCredentialDefinitionOptions = Omit<RegisterCredentialDefinitionOptions, 'options'> & {
  options?: {
    verificationMethod?: string
    extraMetadata?: Record<string, unknown>
  }
}

export type WebVhRegisterRevocationRegistryDefinitionOptions = Omit<
  RegisterRevocationRegistryDefinitionOptions,
  'options'
> & {
  options?: {
    verificationMethod?: string
    extraMetadata?: Record<string, unknown>
  }
}

export type WebVhRegisterRevocationStatusListOptions = Omit<RegisterRevocationStatusListOptions, 'options'> & {
  options?: {
    verificationMethod?: string
    extraMetadata?: Record<string, unknown>
  }
}
