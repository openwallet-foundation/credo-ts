import type { AgentContext } from '@credo-ts/core'
import type {
  DidCommFormatCreateRequestOptions,
  DidCommProofFormatAcceptProposalOptions,
  DidCommProofFormatAcceptRequestOptions,
  DidCommProofFormatAutoRespondPresentationOptions,
  DidCommProofFormatAutoRespondProposalOptions,
  DidCommProofFormatAutoRespondRequestOptions,
  DidCommProofFormatCreateProposalOptions,
  DidCommProofFormatCreateReturn,
  DidCommProofFormatGetCredentialsForRequestOptions,
  DidCommProofFormatGetCredentialsForRequestReturn,
  DidCommProofFormatProcessOptions,
  DidCommProofFormatProcessPresentationOptions,
  DidCommProofFormatSelectCredentialsForRequestOptions,
  DidCommProofFormatSelectCredentialsForRequestReturn,
  DidCommProofFormatService,
} from '@credo-ts/didcomm'
import type {
  AnonCredsCredentialDefinition,
  AnonCredsCredentialInfo,
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
  AnonCredsCredentialsForProofRequest,
  AnonCredsGetCredentialsForProofRequestOptions,
} from './AnonCredsDidCommProofFormat'
import type { LegacyIndyDidCommProofFormat } from './LegacyIndyDidCommProofFormat'

import { CredoError, JsonEncoder, JsonTransformer } from '@credo-ts/core'
import { DidCommAttachment, DidCommAttachmentData, DidCommProofFormatSpec } from '@credo-ts/didcomm'

import { AnonCredsProofRequest as AnonCredsProofRequestClass } from '../models/AnonCredsProofRequest'
import { AnonCredsHolderServiceSymbol, AnonCredsVerifierServiceSymbol } from '../services'
import {
  areAnonCredsProofRequestsEqual,
  assertBestPracticeRevocationInterval,
  assertNoDuplicateGroupsNamesInProofRequest,
  checkValidCredentialValueEncoding,
  createRequestFromPreview,
  fetchCredentialDefinition,
  fetchRevocationStatusList,
  fetchSchema,
  getRevocationRegistriesForProof,
  getRevocationRegistriesForRequest,
  sortRequestedCredentialsMatches,
} from '../utils'
import { encodeCredentialValue } from '../utils/credential'
import {
  getUnQualifiedDidIndyDid,
  getUnqualifiedDidIndyCredentialDefinition,
  getUnqualifiedDidIndySchema,
  isUnqualifiedCredentialDefinitionId,
  isUnqualifiedSchemaId,
} from '../utils/indyIdentifiers'
import { dateToTimestamp } from '../utils/timestamp'

const V2_INDY_PRESENTATION_PROPOSAL = 'hlindy/proof-req@v2.0'
const V2_INDY_PRESENTATION_REQUEST = 'hlindy/proof-req@v2.0'
const V2_INDY_PRESENTATION = 'hlindy/proof@v2.0'

export class LegacyIndyDidCommProofFormatService implements DidCommProofFormatService<LegacyIndyDidCommProofFormat> {
  public readonly formatKey = 'indy' as const

  public async createProposal(
    agentContext: AgentContext,
    { attachmentId, proofFormats }: DidCommProofFormatCreateProposalOptions<LegacyIndyDidCommProofFormat>
  ): Promise<DidCommProofFormatCreateReturn> {
    const holderService = agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)
    const format = new DidCommProofFormatSpec({
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
      nonce: holderService.generateNonce(agentContext),
    })
    const attachment = this.getFormatData(proofRequest, format.attachmentId)

    return { attachment, format }
  }

  public async processProposal(
    _agentContext: AgentContext,
    { attachment }: DidCommProofFormatProcessOptions
  ): Promise<void> {
    const proposalJson = attachment.getDataAsJson<AnonCredsProofRequest>()

    // fromJson also validates
    JsonTransformer.fromJSON(proposalJson, AnonCredsProofRequestClass)

    // Assert attribute and predicate (group) names do not match
    assertNoDuplicateGroupsNamesInProofRequest(proposalJson)
  }

  public async acceptProposal(
    agentContext: AgentContext,
    { proposalAttachment, attachmentId }: DidCommProofFormatAcceptProposalOptions<LegacyIndyDidCommProofFormat>
  ): Promise<DidCommProofFormatCreateReturn> {
    const holderService = agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)
    const format = new DidCommProofFormatSpec({
      format: V2_INDY_PRESENTATION_REQUEST,
      attachmentId,
    })

    const proposalJson = proposalAttachment.getDataAsJson<AnonCredsProofRequest>()

    const request = {
      ...proposalJson,
      // We never want to reuse the nonce from the proposal, as this will allow replay attacks
      nonce: holderService.generateNonce(agentContext),
    }

    const attachment = this.getFormatData(request, format.attachmentId)

    return { attachment, format }
  }

  public async createRequest(
    agentContext: AgentContext,
    { attachmentId, proofFormats }: DidCommFormatCreateRequestOptions<LegacyIndyDidCommProofFormat>
  ): Promise<DidCommProofFormatCreateReturn> {
    const holderService = agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)
    const format = new DidCommProofFormatSpec({
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
      nonce: holderService.generateNonce(agentContext),
      requested_attributes: indyFormat.requested_attributes ?? {},
      requested_predicates: indyFormat.requested_predicates ?? {},
      non_revoked: indyFormat.non_revoked,
    } satisfies AnonCredsProofRequest

    // Assert attribute and predicate (group) names do not match
    assertNoDuplicateGroupsNamesInProofRequest(request)

    const attachment = this.getFormatData(request, format.attachmentId)

    return { attachment, format }
  }

  public async processRequest(
    _agentContext: AgentContext,
    { attachment }: DidCommProofFormatProcessOptions
  ): Promise<void> {
    const requestJson = attachment.getDataAsJson<AnonCredsProofRequest>()

    // fromJson also validates
    JsonTransformer.fromJSON(requestJson, AnonCredsProofRequestClass)

    // Assert attribute and predicate (group) names do not match
    assertNoDuplicateGroupsNamesInProofRequest(requestJson)
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      proofFormats,
      requestAttachment,
      attachmentId,
    }: DidCommProofFormatAcceptRequestOptions<LegacyIndyDidCommProofFormat>
  ): Promise<DidCommProofFormatCreateReturn> {
    const format = new DidCommProofFormatSpec({
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
    { requestAttachment, attachment }: DidCommProofFormatProcessPresentationOptions
  ): Promise<boolean> {
    const verifierService =
      agentContext.dependencyManager.resolve<AnonCredsVerifierService>(AnonCredsVerifierServiceSymbol)

    const proofRequestJson = requestAttachment.getDataAsJson<AnonCredsProofRequest>()

    // NOTE: we don't do validation here, as this is handled by the AnonCreds implementation, however
    // this can lead to confusing error messages. We should consider doing validation here as well.
    // Defining a class-transformer/class-validator class seems a bit overkill, and the usage of interfaces
    // for the anoncreds package keeps things simple. Maybe we can try to use something like zod to validate
    const proofJson = attachment.getDataAsJson<AnonCredsProof>()

    for (const [referent, attribute] of Object.entries(proofJson.requested_proof.revealed_attrs)) {
      if (!checkValidCredentialValueEncoding(attribute.raw, attribute.encoded)) {
        throw new CredoError(
          `The encoded value for '${referent}' is invalid. ` +
            `Expected '${encodeCredentialValue(attribute.raw)}'. ` +
            `Actual '${attribute.encoded}'`
        )
      }
    }

    for (const [, attributeGroup] of Object.entries(proofJson.requested_proof.revealed_attr_groups ?? {})) {
      for (const [attributeName, attribute] of Object.entries(attributeGroup.values)) {
        if (!checkValidCredentialValueEncoding(attribute.raw, attribute.encoded)) {
          throw new CredoError(
            `The encoded value for '${attributeName}' is invalid. ` +
              `Expected '${encodeCredentialValue(attribute.raw)}'. ` +
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

    const revocationRegistries = await getRevocationRegistriesForProof(agentContext, proofJson)

    return await verifierService.verifyProof(agentContext, {
      proofRequest: proofRequestJson,
      proof: proofJson,
      schemas,
      credentialDefinitions,
      revocationRegistries,
    })
  }

  public async getCredentialsForRequest(
    agentContext: AgentContext,
    { requestAttachment, proofFormats }: DidCommProofFormatGetCredentialsForRequestOptions<LegacyIndyDidCommProofFormat>
  ): Promise<DidCommProofFormatGetCredentialsForRequestReturn<LegacyIndyDidCommProofFormat>> {
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
    {
      requestAttachment,
      proofFormats,
    }: DidCommProofFormatSelectCredentialsForRequestOptions<LegacyIndyDidCommProofFormat>
  ): Promise<DidCommProofFormatSelectCredentialsForRequestReturn<LegacyIndyDidCommProofFormat>> {
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
    { proposalAttachment, requestAttachment }: DidCommProofFormatAutoRespondProposalOptions
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
    _agentContext: AgentContext,
    { proposalAttachment, requestAttachment }: DidCommProofFormatAutoRespondRequestOptions
  ): Promise<boolean> {
    const proposalJson = proposalAttachment.getDataAsJson<AnonCredsProofRequest>()
    const requestJson = requestAttachment.getDataAsJson<AnonCredsProofRequest>()

    return areAnonCredsProofRequestsEqual(proposalJson, requestJson)
  }

  public async shouldAutoRespondToPresentation(
    _agentContext: AgentContext,
    _options: DidCommProofFormatAutoRespondPresentationOptions
  ): Promise<boolean> {
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
    options: AnonCredsGetCredentialsForProofRequestOptions
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
            const { isRevoked, timestamp } = await this.getRevocationStatus(
              agentContext,
              proofRequest,
              requestedAttribute,
              credential.credentialInfo
            )

            return {
              credentialId: credential.credentialInfo.credentialId,
              revealed: true,
              credentialInfo: credential.credentialInfo,
              timestamp,
              revoked: isRevoked,
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
            const { isRevoked, timestamp } = await this.getRevocationStatus(
              agentContext,
              proofRequest,
              requestedPredicate,
              credential.credentialInfo
            )

            return {
              credentialId: credential.credentialInfo.credentialId,
              credentialInfo: credential.credentialInfo,
              timestamp,
              revoked: isRevoked,
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

    for (const attributeName of Object.keys(credentialsForRequest.attributes)) {
      const attributeArray = credentialsForRequest.attributes[attributeName]

      if (attributeArray.length === 0) {
        throw new CredoError('Unable to automatically select requested attributes.')
      }

      selectedCredentials.attributes[attributeName] = attributeArray[0]
    }

    for (const attributeName of Object.keys(credentialsForRequest.predicates)) {
      if (credentialsForRequest.predicates[attributeName].length === 0) {
        throw new CredoError('Unable to automatically select requested predicates.')
      }
      selectedCredentials.predicates[attributeName] = credentialsForRequest.predicates[attributeName][0]
    }

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
    const schemas: { [key: string]: AnonCredsSchema } = {}

    for (const schemaId of schemaIds) {
      const schemaResult = await fetchSchema(agentContext, schemaId)
      if (isUnqualifiedSchemaId(schemaResult.schemaId)) {
        schemas[schemaId] = schemaResult.schema
      } else {
        schemas[getUnQualifiedDidIndyDid(schemaId)] = getUnqualifiedDidIndySchema(schemaResult.schema)
      }
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
    const credentialDefinitions: { [key: string]: AnonCredsCredentialDefinition } = {}

    for (const credentialDefinitionId of credentialDefinitionIds) {
      const credentialDefinitionResult = await fetchCredentialDefinition(agentContext, credentialDefinitionId)
      if (isUnqualifiedCredentialDefinitionId(credentialDefinitionResult.credentialDefinitionId)) {
        credentialDefinitions[credentialDefinitionId] = credentialDefinitionResult.credentialDefinition
      } else {
        credentialDefinitions[getUnQualifiedDidIndyDid(credentialDefinitionId)] =
          getUnqualifiedDidIndyCredentialDefinition(credentialDefinitionResult.credentialDefinition)
      }
    }

    return credentialDefinitions
  }

  private async getRevocationStatus(
    agentContext: AgentContext,
    proofRequest: AnonCredsProofRequest,
    requestedItem: AnonCredsRequestedAttribute | AnonCredsRequestedPredicate,
    credentialInfo: AnonCredsCredentialInfo
  ) {
    const requestNonRevoked = requestedItem.non_revoked ?? proofRequest.non_revoked
    const credentialRevocationId = credentialInfo.credentialRevocationId
    const revocationRegistryId = credentialInfo.revocationRegistryId

    // If revocation interval is not present or the credential is not revocable then we
    // don't need to fetch the revocation status
    if (!requestNonRevoked || credentialRevocationId === null || !revocationRegistryId) {
      return { isRevoked: undefined, timestamp: undefined }
    }

    agentContext.config.logger.trace(
      `Fetching credential revocation status for credential revocation id '${credentialRevocationId}' with revocation interval with from '${requestNonRevoked.from}' and to '${requestNonRevoked.to}'`
    )

    // Make sure the revocation interval follows best practices from Aries RFC 0441
    assertBestPracticeRevocationInterval(requestNonRevoked)

    const { revocationStatusList } = await fetchRevocationStatusList(
      agentContext,
      revocationRegistryId,
      requestNonRevoked.to ?? dateToTimestamp(new Date())
    )

    // Item is revoked when the value at the index is 1
    const isRevoked = revocationStatusList.revocationList[Number.parseInt(credentialRevocationId)] === 1

    agentContext.config.logger.trace(
      `Credential with credential revocation index '${credentialRevocationId}' is ${
        isRevoked ? '' : 'not '
      }revoked with revocation interval with to '${requestNonRevoked.to}' & from '${requestNonRevoked.from}'`
    )

    return {
      isRevoked,
      timestamp: revocationStatusList.timestamp,
    }
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
        async (c) => c.credentialInfo ?? holderService.getCredential(agentContext, { id: c.credentialId })
      )
    )

    const schemas = await this.getSchemas(agentContext, new Set(credentialObjects.map((c) => c.schemaId)))
    const credentialDefinitions = await this.getCredentialDefinitions(
      agentContext,
      new Set(credentialObjects.map((c) => c.credentialDefinitionId))
    )

    // selectedCredentials are overridden with specified timestamps of the revocation status list that
    // should be used for the selected credentials.
    const { revocationRegistries, updatedSelectedCredentials } = await getRevocationRegistriesForRequest(
      agentContext,
      proofRequest,
      selectedCredentials
    )

    return await holderService.createProof(agentContext, {
      proofRequest,
      selectedCredentials: updatedSelectedCredentials,
      schemas,
      credentialDefinitions,
      revocationRegistries,
    })
  }

  /**
   * Returns an object of type {@link DidCommAttachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   */
  private getFormatData(data: unknown, id: string): DidCommAttachment {
    const attachment = new DidCommAttachment({
      id,
      mimeType: 'application/json',
      data: new DidCommAttachmentData({
        base64: JsonEncoder.toBase64(data),
      }),
    })

    return attachment
  }
}
