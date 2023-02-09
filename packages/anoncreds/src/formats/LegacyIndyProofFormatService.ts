import type {
  AnonCredsCredentialsForProofRequest,
  AnonCredsGetCredentialsForProofRequestOptions,
} from './AnonCredsProofFormat'
import type { LegacyIndyProofFormat } from './LegacyIndyProofFormat'
import type {
  AnonCredsCredentialDefinition,
  AnonCredsProof,
  AnonCredsProofRequest,
  AnonCredsRequestedAttribute,
  AnonCredsRequestedAttributeMatch,
  AnonCredsRequestedPredicate,
  AnonCredsRequestedPredicateMatch,
  AnonCredsSchema,
  AnonCredsSelectedCredentials,
} from '../models'
import type { AnonCredsHolderService, AnonCredsVerifierService, GetCredentialsForProofRequestReturn } from '../services'
import type {
  ProofFormatService,
  AgentContext,
  ProofFormatCreateReturn,
  FormatCreateRequestOptions,
  ProofFormatCreateProposalOptions,
  ProofFormatProcessOptions,
  ProofFormatAcceptProposalOptions,
  ProofFormatAcceptRequestOptions,
  ProofFormatProcessPresentationOptions,
  ProofFormatGetCredentialsForRequestOptions,
  ProofFormatGetCredentialsForRequestReturn,
  ProofFormatSelectCredentialsForRequestOptions,
  ProofFormatSelectCredentialsForRequestReturn,
  ProofFormatAutoRespondProposalOptions,
  ProofFormatAutoRespondRequestOptions,
  IndyGetCredentialsForProofRequestOptions,
} from '@aries-framework/core'

import { AriesFrameworkError, Attachment, AttachmentData, JsonEncoder, ProofFormatSpec } from '@aries-framework/core'

import { AnonCredsVerifierServiceSymbol, AnonCredsHolderServiceSymbol } from '../services'
import { AnonCredsRegistryService } from '../services/registry/AnonCredsRegistryService'
// TODO: unify utils
import { checkValidEncoding, encode } from '../utils/credential'

import {
  sortRequestedCredentialsMatches,
  createRequestFromPreview,
  hasDuplicateGroupsNamesInProofRequest,
  areAnonCredsProofRequestsEqual,
} from './util'

const V2_INDY_PRESENTATION_PROPOSAL = 'hlindy/proof-req@v2.0'
const V2_INDY_PRESENTATION_REQUEST = 'hlindy/proof-req@v2.0'
const V2_INDY_PRESENTATION = 'hlindy/proof@v2.0'

export class LegacyIndyProofFormatService implements ProofFormatService<LegacyIndyProofFormat> {
  public readonly formatKey = 'indy' as const

  public async createProposal(
    agentContext: AgentContext,
    { attachmentId, proofFormats }: ProofFormatCreateProposalOptions<LegacyIndyProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const format = new ProofFormatSpec({
      format: V2_INDY_PRESENTATION_PROPOSAL,
      attachmentId,
    })

    const indyFormat = proofFormats.indy
    if (!indyFormat) {
      throw Error('Missing indy format to create proposal attachment format')
    }

    const proofRequest = createRequestFromPreview({
      attributes: indyFormat.attributes ?? [],
      predicates: indyFormat.predicates ?? [],
      name: indyFormat.name ?? 'Proof request',
      version: indyFormat.version ?? '1.0',
      nonce: await agentContext.wallet.generateNonce(),
    })
    const attachment = this.getFormatData(proofRequest, format.attachmentId)

    return { attachment, format }
  }

  public async processProposal(agentContext: AgentContext, { attachment }: ProofFormatProcessOptions): Promise<void> {
    // TODO: validation
    const proposalJson = attachment.getDataAsJson<AnonCredsProofRequest>()

    // Assert attribute and predicate (group) names do not match
    if (hasDuplicateGroupsNamesInProofRequest(proposalJson)) {
      throw new AriesFrameworkError('Attribute and predicate (group) names must be unique in proof request')
    }
  }

  public async acceptProposal(
    agentContext: AgentContext,
    { proposalAttachment, attachmentId }: ProofFormatAcceptProposalOptions<LegacyIndyProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const format = new ProofFormatSpec({
      format: V2_INDY_PRESENTATION_REQUEST,
      attachmentId,
    })

    const proposalJson = proposalAttachment.getDataAsJson<AnonCredsProofRequest>()

    const request = {
      ...proposalJson,
      // We never want to reuse the nonce from the proposal, as this will allow replay attacks
      nonce: await agentContext.wallet.generateNonce(),
    }

    const attachment = this.getFormatData(request, format.attachmentId)

    return { attachment, format }
  }

  public async createRequest(
    agentContext: AgentContext,
    { attachmentId, proofFormats }: FormatCreateRequestOptions<LegacyIndyProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const format = new ProofFormatSpec({
      format: V2_INDY_PRESENTATION_REQUEST,
      attachmentId,
    })

    const indyFormat = proofFormats.indy
    if (!indyFormat) {
      throw Error('Missing indy format in create request attachment format')
    }

    const request = {
      name: indyFormat.name,
      version: indyFormat.version,
      nonce: await agentContext.wallet.generateNonce(),
      requested_attributes: indyFormat.requestedAttributes ?? {},
      requested_predicates: indyFormat.requestedPredicates ?? {},
      non_revoked: indyFormat.nonRevoked,
    } satisfies AnonCredsProofRequest

    // Validate to make sure user provided correct input
    if (hasDuplicateGroupsNamesInProofRequest(request)) {
      throw new AriesFrameworkError('Attribute and predicate (group) names must be unique in proof request')
    }

    const attachment = this.getFormatData(request, format.attachmentId)

    return { attachment, format }
  }

  public async processRequest(agentContext: AgentContext, { attachment }: ProofFormatProcessOptions): Promise<void> {
    // TODO: validation
    const requestJson = attachment.getDataAsJson<AnonCredsProofRequest>()

    // Assert attribute and predicate (group) names do not match
    if (hasDuplicateGroupsNamesInProofRequest(requestJson)) {
      throw new AriesFrameworkError('Attribute and predicate (group) names must be unique in proof request')
    }
  }

  public async acceptRequest(
    agentContext: AgentContext,
    { proofFormats, requestAttachment, attachmentId }: ProofFormatAcceptRequestOptions<LegacyIndyProofFormat>
  ): Promise<ProofFormatCreateReturn> {
    const format = new ProofFormatSpec({
      format: V2_INDY_PRESENTATION,
      attachmentId,
    })
    const requestJson = requestAttachment.getDataAsJson<AnonCredsProofRequest>()

    const indyFormat = proofFormats?.indy

    const selectedCredentials =
      indyFormat ??
      (await this._selectCredentialsForRequest(agentContext, requestJson, {
        filterByNonRevocationRequirements: true,
      }))

    const proof = await this.createProof(agentContext, requestJson, selectedCredentials)
    const attachment = this.getFormatData(proof, format.attachmentId)

    return {
      attachment,
      format,
    }
  }

  public async processPresentation(
    agentContext: AgentContext,
    { requestAttachment, attachment }: ProofFormatProcessPresentationOptions
  ): Promise<boolean> {
    const verifierService =
      agentContext.dependencyManager.resolve<AnonCredsVerifierService>(AnonCredsVerifierServiceSymbol)

    const proofRequestJson = requestAttachment.getDataAsJson<AnonCredsProofRequest>()

    // TODO: validation
    const proofJson = attachment.getDataAsJson<AnonCredsProof>()

    for (const [referent, attribute] of Object.entries(proofJson.requested_proof.revealed_attrs)) {
      if (!checkValidEncoding(attribute.raw, attribute.encoded)) {
        throw new AriesFrameworkError(
          `The encoded value for '${referent}' is invalid. ` +
            `Expected '${encode(attribute.raw)}'. ` +
            `Actual '${attribute.encoded}'`
        )
      }
    }

    for (const [, attributeGroup] of Object.entries(proofJson.requested_proof.revealed_attr_groups ?? {})) {
      for (const [attributeName, attribute] of Object.entries(attributeGroup.values)) {
        if (!checkValidEncoding(attribute.raw, attribute.encoded)) {
          throw new AriesFrameworkError(
            `The encoded value for '${attributeName}' is invalid. ` +
              `Expected '${encode(attribute.raw)}'. ` +
              `Actual '${attribute.encoded}'`
          )
        }
      }
    }

    // TODO: pre verify proof json
    // I'm not 100% sure how much indy does. Also if it checks whether the proof requests matches the proof
    // @see https://github.com/hyperledger/aries-cloudagent-python/blob/master/aries_cloudagent/indy/sdk/verifier.py#L79-L164

    const schemas = await this.getSchemas(agentContext, new Set(proofJson.identifiers.map((i) => i.schema_id)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      agentContext,
      new Set(proofJson.identifiers.map((i) => i.cred_def_id))
    )

    return await verifierService.verifyProof(agentContext, {
      proofRequest: proofRequestJson,
      proof: proofJson,
      schemas,
      credentialDefinitions,
      // TODO: revocation registry definitions
      revocationStates: {},
    })
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    { requestAttachment, proofFormats }: ProofFormatGetCredentialsForRequestOptions<LegacyIndyProofFormat>
  ): Promise<ProofFormatGetCredentialsForRequestReturn<LegacyIndyProofFormat>> {
    const proofRequestJson = requestAttachment.getDataAsJson<AnonCredsProofRequest>()

    // Set default values
    const { filterByNonRevocationRequirements = true } = proofFormats?.indy ?? {}

    const credentialsForRequest = await this._getCredentialsForRequest(agentContext, proofRequestJson, {
      filterByNonRevocationRequirements,
    })

    return credentialsForRequest
  }

  public async selectCredentialsForRequest(
    agentContext: AgentContext,
    { requestAttachment, proofFormats }: ProofFormatSelectCredentialsForRequestOptions<LegacyIndyProofFormat>
  ): Promise<ProofFormatSelectCredentialsForRequestReturn<LegacyIndyProofFormat>> {
    const proofRequestJson = requestAttachment.getDataAsJson<AnonCredsProofRequest>()

    // Set default values
    const { filterByNonRevocationRequirements = true } = proofFormats?.indy ?? {}

    const selectedCredentials = this._selectCredentialsForRequest(agentContext, proofRequestJson, {
      filterByNonRevocationRequirements,
    })

    return selectedCredentials
  }

  public async shouldAutoRespondToProposal(
    agentContext: AgentContext,
    { proposalAttachment, requestAttachment }: ProofFormatAutoRespondProposalOptions
  ): Promise<boolean> {
    const proposalJson = proposalAttachment.getDataAsJson<AnonCredsProofRequest>()
    const requestJson = requestAttachment.getDataAsJson<AnonCredsProofRequest>()

    const areRequestsEqual = areAnonCredsProofRequestsEqual(proposalJson, requestJson)
    agentContext.config.logger.debug(`AnonCreds request and proposal are are equal: ${areRequestsEqual}`, {
      proposalJson,
      requestJson,
    })

    return areRequestsEqual
  }

  public async shouldAutoRespondToRequest(
    agentContext: AgentContext,
    { proposalAttachment, requestAttachment }: ProofFormatAutoRespondRequestOptions
  ): Promise<boolean> {
    const proposalJson = proposalAttachment.getDataAsJson<AnonCredsProofRequest>()
    const requestJson = requestAttachment.getDataAsJson<AnonCredsProofRequest>()

    return areAnonCredsProofRequestsEqual(proposalJson, requestJson)
  }

  public async shouldAutoRespondToPresentation(): Promise<boolean> {
    // The presentation is already verified in processPresentation, so we can just return true here.
    // It's only an ack, so it's just that we received the presentation.
    return true
  }

  public supportsFormat(formatIdentifier: string): boolean {
    const supportedFormats = [V2_INDY_PRESENTATION_PROPOSAL, V2_INDY_PRESENTATION_REQUEST, V2_INDY_PRESENTATION]
    return supportedFormats.includes(formatIdentifier)
  }

  private async _getCredentialsForRequest(
    agentContext: AgentContext,
    proofRequest: AnonCredsProofRequest,
    options: IndyGetCredentialsForProofRequestOptions
  ): Promise<AnonCredsCredentialsForProofRequest> {
    const credentialsForProofRequest: AnonCredsCredentialsForProofRequest = {
      attributes: {},
      predicates: {},
    }

    for (const [referent, requestedAttribute] of Object.entries(proofRequest.requested_attributes)) {
      const credentials = await this.getCredentialsForProofRequestReferent(agentContext, proofRequest, referent)

      credentialsForProofRequest.attributes[referent] = sortRequestedCredentialsMatches(
        await Promise.all(
          credentials.map(async (credential) => {
            const { revoked, deltaTimestamp } = await this.getRevocationStatusForRequestedItem(agentContext, {
              proofRequest,
              requestedItem: requestedAttribute,
              credential,
            })

            return {
              credentialId: credential.credentialInfo.credentialId,
              revealed: true,
              credentialInfo: credential.credentialInfo,
              timestamp: deltaTimestamp,
              revoked,
            } satisfies AnonCredsRequestedAttributeMatch
          })
        )
      )

      // We only attach revoked state if non-revocation is requested. So if revoked is true it means
      // the credential is not applicable to the proof request
      if (options.filterByNonRevocationRequirements) {
        credentialsForProofRequest.attributes[referent] = credentialsForProofRequest.attributes[referent].filter(
          (r) => !r.revoked
        )
      }
    }

    for (const [referent, requestedPredicate] of Object.entries(proofRequest.requested_predicates)) {
      const credentials = await this.getCredentialsForProofRequestReferent(agentContext, proofRequest, referent)

      credentialsForProofRequest.predicates[referent] = sortRequestedCredentialsMatches(
        await Promise.all(
          credentials.map(async (credential) => {
            const { revoked, deltaTimestamp } = await this.getRevocationStatusForRequestedItem(agentContext, {
              proofRequest,
              requestedItem: requestedPredicate,
              credential,
            })

            return {
              credentialId: credential.credentialInfo.credentialId,
              credentialInfo: credential.credentialInfo,
              timestamp: deltaTimestamp,
              revoked,
            } satisfies AnonCredsRequestedPredicateMatch
          })
        )
      )

      // We only attach revoked state if non-revocation is requested. So if revoked is true it means
      // the credential is not applicable to the proof request
      if (options.filterByNonRevocationRequirements) {
        credentialsForProofRequest.predicates[referent] = credentialsForProofRequest.predicates[referent].filter(
          (r) => !r.revoked
        )
      }
    }

    return credentialsForProofRequest
  }

  private async _selectCredentialsForRequest(
    agentContext: AgentContext,
    proofRequest: AnonCredsProofRequest,
    options: AnonCredsGetCredentialsForProofRequestOptions
  ): Promise<AnonCredsSelectedCredentials> {
    const credentialsForRequest = await this._getCredentialsForRequest(agentContext, proofRequest, options)

    const selectedCredentials: AnonCredsSelectedCredentials = {
      attributes: {},
      predicates: {},
      selfAttestedAttributes: {},
    }

    Object.keys(credentialsForRequest.attributes).forEach((attributeName) => {
      const attributeArray = credentialsForRequest.attributes[attributeName]

      if (attributeArray.length === 0) {
        throw new AriesFrameworkError('Unable to automatically select requested attributes.')
      }

      selectedCredentials.attributes[attributeName] = attributeArray[0]
    })

    Object.keys(credentialsForRequest.predicates).forEach((attributeName) => {
      if (credentialsForRequest.predicates[attributeName].length === 0) {
        throw new AriesFrameworkError('Unable to automatically select requested predicates.')
      } else {
        selectedCredentials.predicates[attributeName] = credentialsForRequest.predicates[attributeName][0]
      }
    })

    return selectedCredentials
  }

  private async getCredentialsForProofRequestReferent(
    agentContext: AgentContext,
    proofRequest: AnonCredsProofRequest,
    attributeReferent: string
  ): Promise<GetCredentialsForProofRequestReturn> {
    const holderService = agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const credentials = await holderService.getCredentialsForProofRequest(agentContext, {
      proofRequest,
      attributeReferent,
    })

    return credentials
  }

  /**
   * Build schemas object needed to create and verify proof objects.
   *
   * Creates object with `{ schemaId: AnonCredsSchema }` mapping
   *
   * @param schemaIds List of schema ids
   * @returns Object containing schemas for specified schema ids
   *
   */
  private async getSchemas(agentContext: AgentContext, schemaIds: Set<string>) {
    const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)

    const schemas: { [key: string]: AnonCredsSchema } = {}

    for (const schemaId of schemaIds) {
      const schemaRegistry = registryService.getRegistryForIdentifier(agentContext, schemaId)
      const schemaResult = await schemaRegistry.getSchema(agentContext, schemaId)

      if (!schemaResult.schema) {
        throw new AriesFrameworkError(`Schema not found for id ${schemaId}: ${schemaResult.resolutionMetadata.message}`)
      }

      schemas[schemaId] = schemaResult.schema
    }

    return schemas
  }

  /**
   * Build credential definitions object needed to create and verify proof objects.
   *
   * Creates object with `{ credentialDefinitionId: AnonCredsCredentialDefinition }` mapping
   *
   * @param credentialDefinitionIds List of credential definition ids
   * @returns Object containing credential definitions for specified credential definition ids
   *
   */
  private async getCredentialDefinitions(agentContext: AgentContext, credentialDefinitionIds: Set<string>) {
    const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)

    const credentialDefinitions: { [key: string]: AnonCredsCredentialDefinition } = {}

    for (const credentialDefinitionId of credentialDefinitionIds) {
      const credentialDefinitionRegistry = registryService.getRegistryForIdentifier(
        agentContext,
        credentialDefinitionId
      )

      const credentialDefinitionResult = await credentialDefinitionRegistry.getCredentialDefinition(
        agentContext,
        credentialDefinitionId
      )

      if (!credentialDefinitionResult.credentialDefinition) {
        throw new AriesFrameworkError(
          `Credential definition not found for id ${credentialDefinitionId}: ${credentialDefinitionResult.resolutionMetadata.message}`
        )
      }

      credentialDefinitions[credentialDefinitionId] = credentialDefinitionResult.credentialDefinition
    }

    return credentialDefinitions
  }

  /**
   * Create indy proof from a given proof request and requested credential object.
   *
   * @param proofRequest The proof request to create the proof for
   * @param requestedCredentials The requested credentials object specifying which credentials to use for the proof
   * @returns indy proof object
   */
  private async createProof(
    agentContext: AgentContext,
    proofRequest: AnonCredsProofRequest,
    selectedCredentials: AnonCredsSelectedCredentials
  ): Promise<AnonCredsProof> {
    const holderService = agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const credentialObjects = await Promise.all(
      [...Object.values(selectedCredentials.attributes), ...Object.values(selectedCredentials.predicates)].map(
        async (c) => c.credentialInfo ?? holderService.getCredential(agentContext, { credentialId: c.credentialId })
      )
    )

    const schemas = await this.getSchemas(agentContext, new Set(credentialObjects.map((c) => c.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      agentContext,
      new Set(credentialObjects.map((c) => c.credentialDefinitionId))
    )

    return await holderService.createProof(agentContext, {
      proofRequest,
      selectedCredentials,
      schemas,
      credentialDefinitions,
      // TODO: resolve and pass revocation registries
      revocationRegistries: {},
    })
  }

  private async getRevocationStatusForRequestedItem(
    agentContext: AgentContext,
    {
      proofRequest,
      requestedItem,
      credential,
    }: {
      proofRequest: AnonCredsProofRequest
      requestedItem: AnonCredsRequestedAttribute | AnonCredsRequestedPredicate
      credential: GetCredentialsForProofRequestReturn[number]
    }
  ) {
    // const indyRevocationService = agentContext.dependencyManager.resolve(IndyRevocationService)

    const requestNonRevoked = requestedItem.non_revoked ?? proofRequest.non_revoked
    const credentialRevocationId = credential.credentialInfo.credentialRevocationId
    const revocationRegistryId = credential.credentialInfo.revocationRegistryId

    // If revocation interval is present and the credential is revocable then fetch the revocation status of credentials for display
    if (requestNonRevoked && credentialRevocationId && revocationRegistryId) {
      agentContext.config.logger.trace(
        `Presentation is requesting proof of non revocation, getting revocation status for credential`,
        {
          requestNonRevoked,
          credentialRevocationId,
          revocationRegistryId,
        }
      )

      // TODO: update this to use the anoncreds registry
      // Note presentation from-to's vs ledger from-to's: https://github.com/hyperledger/indy-hipe/blob/master/text/0011-cred-revocation/README.md#indy-node-revocation-registry-intervals
      //   const status = await indyRevocationService.getRevocationStatus(
      //     agentContext,
      //     credentialRevocationId,
      //     revocationRegistryId,
      //     requestNonRevoked
      //   )

      return { status: undefined, deltaTimestamp: undefined }
    }

    return { revoked: undefined, deltaTimestamp: undefined }
  }

  /**
   * Returns an object of type {@link Attachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   */
  private getFormatData(data: unknown, id: string): Attachment {
    const attachment = new Attachment({
      id,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(data),
      }),
    })

    return attachment
  }
}
