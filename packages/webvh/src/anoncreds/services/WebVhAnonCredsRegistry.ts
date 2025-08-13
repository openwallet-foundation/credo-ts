import type {
  AnonCredsRegistry,
  AnonCredsRevocationRegistryDefinition,
  AnonCredsRevocationRegistryDefinitionValue,
  GetCredentialDefinitionReturn,
  GetRevocationRegistryDefinitionReturn,
  GetRevocationStatusListReturn,
  GetSchemaReturn,
  RegisterCredentialDefinitionReturn,
  RegisterRevocationRegistryDefinitionReturn,
  RegisterRevocationStatusListReturn,
  RegisterSchemaReturn,
} from '@credo-ts/anoncreds'
import type { AgentContext } from '@credo-ts/core'

import {
  CredoError,
  JsonTransformer,
  MultiBaseEncoder,
  MultiHashEncoder,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { canonicalize } from 'json-canonicalize'
import { EddsaJcs2022Cryptosuite } from '../../cryptosuites/eddsa-jcs-2022'
import { WebvhDidResolver } from '../../dids'
import { WebVhResource } from '../utils/transform'

type DidResourceResolutionResult = {
  error?: string
  message?: string
  content?: Record<string, unknown> | unknown[] | string // More specific than any, but still flexible
  contentMetadata?: Record<string, unknown>
  dereferencingMetadata?: Record<string, unknown>
}

export class WebVhAnonCredsRegistry implements AnonCredsRegistry {
  public methodName = 'webvh'

  /**
   * This class supports resolving objects with did:webvh identifiers.
   */
  public readonly supportedIdentifier = /^did:webvh:.*/

  /**
   * Resolves a resource using the WebvhDidResolver and performs common validation steps.
   *
   * @param agentContext The agent context.
   * @param resourceId The DID URI of the resource to resolve.
   * @param resourceTypeString A descriptive string for the resource type (e.g., 'schema', 'credential definition') used in logs/errors.
   * @returns The parsed and validated WebVhResource object and the original resolution result.
   * @throws {CredoError} If resolution, parsing, or validation fails.
   */
  private _digestMultibase(value: string) {
    const valueBytes = TypedArrayEncoder.fromString(value)
    const digestMultihash = MultiHashEncoder.encode(valueBytes, 'sha-256')
    const digestMultibase = MultiBaseEncoder.encode(digestMultihash, 'base58btc')
    return digestMultibase

  }
  private async _resolveAndValidateAttestedResource(
    agentContext: AgentContext,
    resourceId: string,
    resourceTypeString: string
  ): Promise<{ resourceObject: WebVhResource; resolutionResult: DidResourceResolutionResult }> {
    try {
      const webvhDidResolver = agentContext.dependencyManager.resolve(WebvhDidResolver)
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

      let resourceObject: WebVhResource
      try {
        agentContext.config.logger.trace(
          `Parsing resource data: ${JSON.stringify(resolutionResult.content).substring(0, 200)}...`
        )
        resourceObject = JsonTransformer.fromJSON(resolutionResult.content, WebVhResource)
      } catch (parseError) {
        agentContext.config.logger.error(`Failed to parse resource data for ${resourceId}`, {
          error: parseError instanceof Error ? parseError.message : String(parseError),
          stack: parseError instanceof Error ? parseError.stack : undefined,
        })
        throw new CredoError(
          `Failed to parse resource data for ${resourceId}: ${parseError instanceof Error ? parseError.message : String(parseError)
          }`
        )
      }

      // --- Attested Resource Validation steps ---

      // 1. Data Model Verification
      if (!Array.isArray(resourceObject.type) || !resourceObject.type.includes('AttestedResource')) {
        throw new CredoError('Missing AttestedResource type.')
      }
      if (!resourceObject.id || typeof resourceObject.id !== 'string') {
        throw new CredoError('Missing resource id.')
      }
      if (!resourceObject.content || typeof resourceObject.content !== 'object') {
        throw new CredoError('Missing resource content.')
      }
      if (resourceObject.metadata && typeof resourceObject.metadata !== 'object') {
        throw new CredoError('Expecting metadata to be an object.')
      }
      if (resourceObject.links && typeof resourceObject.links !== 'object') {
        throw new CredoError('Expecting metadata to be an array.')
      }
      if (!resourceObject.proof || typeof resourceObject.proof !== 'object') {
        throw new CredoError('Missing resource proof.')
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
      if (resourceObject.id != resourceId) {
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
      if (!('attrNames' in schemaContent) || !('name' in schemaContent) || !('version' in schemaContent) || !('issuerId' in schemaContent)) {
        throw new CredoError(`Parsed resource content for ${schemaId} is not a valid schema.`)
      }

      // Use the issuerId from the content if available, otherwise extract from schemaId
      // We need the hash part for this, extract it again or pass from helper?
      // For simplicity, extract again.
      const parts = schemaId.split(/[:/]/)
      const expectedMultibaseHash = parts[parts.length - 1]
      const issuerId = schemaContent.issuerId ||
        schemaId.substring(0, schemaId.lastIndexOf(expectedMultibaseHash)).replace(/[:/]$/, '')

      return {
        schema: {
          attrNames: schemaContent.attrNames,
          name: schemaContent.name,
          version: schemaContent.version,
          issuerId
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
      if (
        !('schemaId' in credDefContent) ||
        !('type' in credDefContent) ||
        !('tag' in credDefContent) ||
        !('value' in credDefContent)
      ) {
        throw new CredoError('Resolved resource content is not a valid credential definition.')
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

      if (
        !('revocDefType' in revRegDefContent) ||
        !('credDefId' in revRegDefContent) ||
        !('tag' in revRegDefContent) ||
        !('value' in revRegDefContent)
      ) {
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
          value: revRegDefContent.value as AnonCredsRevocationRegistryDefinitionValue, // TODO: Map value structure to AnonCreds type
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
          message: `unable to resolve revocation registry definition: ${error instanceof Error ? error.message : String(error)
            }`,
        },
        revocationRegistryDefinitionMetadata: {},
      }
    }
  }

  public async getRevocationStatusList(
    agentContext: AgentContext,
    revocationRegistryId: string,
    timestamp: number // TODO: How should timestamp be handled?
  ): Promise<GetRevocationStatusListReturn> {
    try {
      const webvhDidResolver = agentContext.dependencyManager.resolve(WebvhDidResolver)
      if (!revocationRegistryId.startsWith('did:web:'))
        throw new CredoError(`Invalid revocationRegistryId: ${revocationRegistryId}`)

      agentContext.config.logger.trace(
        `Attempting to resolve revocation status list resource for '${revocationRegistryId}' at timestamp ${timestamp} via did:web resolver`
      )

      // TODO: Determine how to incorporate the timestamp into the resolution process for did:web
      // Maybe resolving just the revocationRegistryId gives the structure, and another resource/path gives the status at a time?
      // For now, just resolving the base ID.
      const effectiveIdToResolve = revocationRegistryId // Adjust this based on timestamp handling strategy

      // Attempt to resolve the resource
      await webvhDidResolver.resolveResource(agentContext, effectiveIdToResolve)

      // TODO: Implement actual logic for parsing the resolved resource into AnonCreds RevocationStatusList format
      throw new CredoError('Method not implemented.')

      // Placeholder return - replace with actual implementation
      /*
      return {
        revocationStatusList: {
          issuerId: '', // Extract issuerId from revocationRegistryId or resolved data
          revRegDefId: revocationRegistryId,
          currentAccumulator: '', // Replace with actual data
          revocationList: [], // Replace with actual data
          timestamp: 0 // Extract or determine timestamp based on resolved data
        },
        resolutionMetadata: {},
        revocationStatusListMetadata: {},
      }
      */
    } catch (error) {
      agentContext.config.logger.error(
        `Error retrieving revocation registry status list '${revocationRegistryId}' via did:web`,
        {
          error,
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

  public async registerSchema(agentContext: AgentContext): Promise<RegisterSchemaReturn> {
    agentContext.config.logger.warn('registerSchema not implemented for WebVhAnonCredsRegistry')
    throw new CredoError('Method not implemented.')
  }

  public async registerCredentialDefinition(agentContext: AgentContext): Promise<RegisterCredentialDefinitionReturn> {
    agentContext.config.logger.warn('registerCredentialDefinition not implemented for WebVhAnonCredsRegistry')
    throw new CredoError('Method not implemented.')
  }

  public async registerRevocationRegistryDefinition(
    agentContext: AgentContext
  ): Promise<RegisterRevocationRegistryDefinitionReturn> {
    agentContext.config.logger.warn('registerRevocationRegistryDefinition not implemented for WebVhAnonCredsRegistry')
    throw new CredoError('Method not implemented.')
  }

  public async registerRevocationStatusList(agentContext: AgentContext): Promise<RegisterRevocationStatusListReturn> {
    agentContext.config.logger.warn('registerRevocationStatusList not implemented for WebVhAnonCredsRegistry')
    throw new CredoError('Method not implemented.')
  }

  public async verifyProof(agentContext: AgentContext, attestedResource: any): Promise<boolean> {
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
}
