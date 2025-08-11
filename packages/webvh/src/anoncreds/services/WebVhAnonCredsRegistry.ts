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
import type { AgentContext, DataIntegrityProof, VerificationMethod } from '@credo-ts/core'

import {
  CredoError,
  DidsApi,
  JsonTransformer,
  MultiBaseEncoder,
  MultiHashEncoder,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { canonicalize } from 'json-canonicalize'

import { HashData } from '../../utils'
import { WebvhDidCrypto, WebvhDidResolver } from '../../dids'
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
          `Failed to parse resource data for ${resourceId}: ${
            parseError instanceof Error ? parseError.message : String(parseError)
          }`
        )
      }

      // --- Validation Steps on parsed object ---
      // 1. Check for attestation type
      if (!Array.isArray(resourceObject.type) || !resourceObject.type.includes('AttestedResource')) {
        throw new CredoError('Resolved resource data is not attested.')
      }
      agentContext.config.logger.trace(`Resource ${resourceId} attestation found.`)

      // 2. Check for valid proof
      const unsecuredDocument = (({ proof, ...o }) => o)(resourceObject);
      const isProofValid = await this.verifyProof(agentContext, resourceObject.proof, unsecuredDocument)
      if (!isProofValid) {
        throw new CredoError('Resolved resource proof is invalid.')
      }
      agentContext.config.logger.trace(`Resource ${resourceId} proof validated.`)

      // 3. Check filename hash against content hash
      const contentObject = resourceObject.content
      if (!contentObject) {
        throw new CredoError('Resolved resource data does not contain a content object.')
      }

      const parts = resourceId.split(/[:/]/)
      const expectedMultibaseHash = parts[parts.length - 1]
      if (!expectedMultibaseHash) {
        throw new CredoError(`Could not extract expected hash from ${resourceTypeString} ID: ${resourceId}`)
      }

      const contentString = canonicalize(contentObject)
      const actualHashMultibase = MultiBaseEncoder.encode(
        MultiHashEncoder.encode(TypedArrayEncoder.fromString(contentString), 'sha-256'),
        'base58btc'
      )

      if (actualHashMultibase !== expectedMultibaseHash) {
        throw new CredoError(
          `Content hash mismatch for ${resourceId}. Expected: ${expectedMultibaseHash}, Actual: ${actualHashMultibase}`
        )
      }
      agentContext.config.logger.trace(`Resource ${resourceId} content hash matches filename.`)

      // 4. Check that the issuerId in the content matches the DID part of the resourceId
      const contentIssuerId = (contentObject as { issuerId?: string })?.issuerId // Type assertion for accessing issuerId
      if (!contentIssuerId || typeof contentIssuerId !== 'string') {
        throw new CredoError(`Resolved resource content for ${resourceId} is missing a valid issuerId.`)
      }

      // Extract the DID from the resourceId (part before /resources/hash)
      const resourceDidMatch = resourceId.match(/^(did:webvh:[^/]+)/)
      if (!resourceDidMatch || !resourceDidMatch[1]) {
        throw new CredoError(`Could not extract DID from resource ID: ${resourceId}`)
      }
      const expectedIssuerDid = resourceDidMatch[1]

      if (contentIssuerId !== expectedIssuerDid) {
        throw new CredoError(
          `Issuer ID mismatch for ${resourceId}. Expected: ${expectedIssuerDid}, Actual: ${contentIssuerId}`
        )
      }
      agentContext.config.logger.trace(`Resource ${resourceId} issuer ID matches DID.`)

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
      if (!('attrNames' in schemaContent) || !('name' in schemaContent) || !('version' in schemaContent)) {
        throw new CredoError(`Parsed resource content for ${schemaId} is not a valid schema.`)
      }

      // Use the issuerId from the content if available, otherwise extract from schemaId
      // We need the hash part for this, extract it again or pass from helper?
      // For simplicity, extract again.
      const parts = schemaId.split(/[:/]/)
      const expectedMultibaseHash = parts[parts.length - 1]
      const issuerId =
        schemaContent.issuerId ||
        schemaId.substring(0, schemaId.lastIndexOf(expectedMultibaseHash)).replace(/[:/]$/, '')

      return {
        schema: {
          attrNames: schemaContent.attrNames,
          name: schemaContent.name,
          version: schemaContent.version,
          issuerId: issuerId,
        },
        schemaId,
        resolutionMetadata: resolutionResult.dereferencingMetadata || {},
        schemaMetadata: resolutionResult.contentMetadata || {},
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

  // Proof validation logic for DataIntegrityProof with eddsa-jcs-2022
  public async verifyProof(agentContext: AgentContext, proof: DataIntegrityProof, unsecuredDocument: unknown): Promise<boolean> {
    try {
      // Type check the proof object
      if (!proof || typeof proof !== 'object') {
        agentContext.config.logger.error('Invalid proof: proof must be an object in did:webvh resource proof')
        return false
      }

      // Validate proof structure for DataIntegrityProof
      if (!proof.type || proof.type !== 'DataIntegrityProof') {
        agentContext.config.logger.error(`Unsupported type: ${proof.type} in did:webvh resource proof`)
        return false
      }

      if (!proof.cryptosuite || proof.cryptosuite !== 'eddsa-jcs-2022') {
        agentContext.config.logger.error(`Unsupported cryptosuite: ${proof.cryptosuite} in did:webvh resource proof`)
        return false
      }

      if (!proof.proofValue || proof.proofPurpose !== 'assertionMethod') {
        agentContext.config.logger.error('Invalid proofPurpose in did:webvh resource proof')
        return false
      }

      if (!proof.verificationMethod || typeof proof.verificationMethod !== 'string') {
        agentContext.config.logger.error('Invalid verificationMethod in did:webvh resource proof')
        return false
      }

      if (!proof.proofValue || typeof proof.proofValue !== 'string') {
        agentContext.config.logger.error('Invalid proofValue in did:webvh resource proof')
        return false
      }

      // Resolve the verification method to get the public key
      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const didDocument = await didsApi.resolveDidDocument(proof.verificationMethod as string)

      if (!didDocument) {
        agentContext.config.logger.error('Could not resolve verification method did:webvh DID document')
        return false
      }

      // Extract the verification method from the DID document
      let verificationMethod: VerificationMethod | undefined
      if ((proof.verificationMethod as string).includes('#')) {
        const fragment = (proof.verificationMethod as string).split('#')[1]
        verificationMethod = didDocument.verificationMethod?.find((vm: VerificationMethod) =>
          vm.id.endsWith(`#${fragment}`)
        )
      }

      if (!verificationMethod) {
        agentContext.config.logger.error('Could not find verification method in did:webvh DID document')
        return false
      }

      // Extract public key from verification method
      let publicKeyBytes: Uint8Array
      if ('publicKeyMultibase' in verificationMethod && verificationMethod.publicKeyMultibase) {
        const publicKeyBuffer = MultiBaseEncoder.decode(verificationMethod.publicKeyMultibase)
        publicKeyBytes = publicKeyBuffer.data
      } else {
        agentContext.config.logger.error(
          'did:webvh resource verification method does not contain a supported public key format'
        )
        return false
      }

      // For eddsa-jcs-2022 hashing algorithm:
      // https://www.w3.org/TR/vc-di-eddsa/#hashing-eddsa-jcs-2022
      const proofConfig = (({ proofValue, ...o }) => o)(proof);
      const proofConfigHash = HashData(canonicalize(proofConfig));
      const transformedDocumentHash = HashData(canonicalize(unsecuredDocument));
      const hashData = proofConfigHash+transformedDocumentHash;

      // Decode the signature from the proofValue (should be multibase encoded)
      const signatureBuffer = MultiBaseEncoder.decode(proof.proofValue as string)

      const crypto = new WebvhDidCrypto(agentContext)
      const isVerified = await crypto.verify(signatureBuffer.data, hashData, publicKeyBytes)

      if (!isVerified) {
        agentContext.config.logger.error('Signature verification failed for did:webvh resource')
        return false
      }

      agentContext.config.logger.debug('DataIntegrityProof verification successful')
      return true
    } catch (error) {
      agentContext.config.logger.error('Error during proof validation of did:webvh resource', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return false
    }
  }
}
