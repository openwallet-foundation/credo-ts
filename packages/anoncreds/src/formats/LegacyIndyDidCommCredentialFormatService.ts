import type { AgentContext } from '@credo-ts/core'
import { CredoError, JsonEncoder, JsonTransformer, MessageValidator } from '@credo-ts/core'
import type {
  DidCommCredentialExchangeRecord,
  DidCommCredentialFormatAcceptOfferOptions,
  DidCommCredentialFormatAcceptProposalOptions,
  DidCommCredentialFormatAcceptRequestOptions,
  DidCommCredentialFormatAutoRespondCredentialOptions,
  DidCommCredentialFormatAutoRespondOfferOptions,
  DidCommCredentialFormatAutoRespondProposalOptions,
  DidCommCredentialFormatAutoRespondRequestOptions,
  DidCommCredentialFormatCreateOfferOptions,
  DidCommCredentialFormatCreateOfferReturn,
  DidCommCredentialFormatCreateProposalOptions,
  DidCommCredentialFormatCreateProposalReturn,
  DidCommCredentialFormatCreateReturn,
  DidCommCredentialFormatProcessCredentialOptions,
  DidCommCredentialFormatProcessOptions,
  DidCommCredentialFormatService,
  DidCommCredentialPreviewAttributeOptions,
} from '@credo-ts/didcomm'
import {
  DidCommAttachment,
  DidCommCredentialFormatSpec,
  DidCommCredentialProblemReportReason,
  DidCommProblemReportError,
} from '@credo-ts/didcomm'
import type { AnonCredsCredential, AnonCredsCredentialOffer, AnonCredsCredentialRequest } from '../models'
import { AnonCredsCredentialProposal } from '../models/AnonCredsCredentialProposal'
import type { AnonCredsHolderService, AnonCredsIssuerService } from '../services'
import { AnonCredsHolderServiceSymbol, AnonCredsIssuerServiceSymbol } from '../services'
import { fetchCredentialDefinition, fetchRevocationRegistryDefinition, fetchSchema } from '../utils'
import {
  assertAttributesMatch,
  assertCredentialValuesMatch,
  checkCredentialValuesMatch,
  convertAttributesToCredentialValues,
} from '../utils/credential'
import { isUnqualifiedCredentialDefinitionId, isUnqualifiedSchemaId } from '../utils/indyIdentifiers'
import type { AnonCredsCredentialMetadata, AnonCredsCredentialRequestMetadata } from '../utils/metadata'
import { AnonCredsCredentialMetadataKey, AnonCredsCredentialRequestMetadataKey } from '../utils/metadata'
import { generateLegacyProverDidLikeString } from '../utils/proverDid'
import { getStoreCredentialOptions } from '../utils/w3cAnonCredsUtils'
import type {
  LegacyIndyCredentialFormat,
  LegacyIndyDidCommCredentialProposalFormat,
} from './LegacyIndyDidCommCredentialFormat'

const INDY_CRED_ABSTRACT = 'hlindy/cred-abstract@v2.0'
const INDY_CRED_REQUEST = 'hlindy/cred-req@v2.0'
const INDY_CRED_FILTER = 'hlindy/cred-filter@v2.0'
const INDY_CRED = 'hlindy/cred@v2.0'

export class LegacyIndyDidCommCredentialFormatService
  implements DidCommCredentialFormatService<LegacyIndyCredentialFormat>
{
  /** formatKey is the key used when calling agent.credentials.xxx with credentialFormats.indy */
  public readonly formatKey = 'indy' as const

  /**
   * credentialRecordType is the type of record that stores the credential. It is stored in the credential
   * record binding in the credential exchange record.
   */
  public readonly credentialRecordType = 'w3c' as const

  private hasLoggedWarning = false
  private ensureWarningLoggedOnce(agentContext: AgentContext) {
    if (this.hasLoggedWarning) return

    agentContext.config.logger.debug(
      "The 'LegacyIndyDidCommCredentialFormatService' is deprecated and will be removed in version 0.7 of Credo. You should upgrade to the 'AnonCredsDidCommCredentialFormatService' instead."
    )
    this.hasLoggedWarning = true
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the proposed credential
   * @returns object containing associated attachment, format and optionally the credential preview
   *
   */
  public async createProposal(
    agentContext: AgentContext,
    {
      credentialFormats,
      credentialExchangeRecord,
    }: DidCommCredentialFormatCreateProposalOptions<LegacyIndyCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateProposalReturn> {
    this.ensureWarningLoggedOnce(agentContext)
    const format = new DidCommCredentialFormatSpec({
      format: INDY_CRED_FILTER,
    })

    const indyFormat = credentialFormats.indy

    if (!indyFormat) {
      throw new CredoError('Missing indy payload in createProposal')
    }

    const { attributes, ...indyCredentialProposal } = indyFormat
    const proposal = new AnonCredsCredentialProposal(indyCredentialProposal)

    try {
      MessageValidator.validateSync(proposal)
    } catch (_error) {
      throw new CredoError(`Invalid proposal supplied: ${indyCredentialProposal} in Indy Format Service`)
    }

    const attachment = this.getFormatData(JsonTransformer.toJSON(proposal), format.attachmentId)

    // Set the metadata
    credentialExchangeRecord.metadata.set<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
      schemaId: proposal.schemaId,
      credentialDefinitionId: proposal.credentialDefinitionId,
    })

    return { format, attachment, previewAttributes: attributes }
  }

  public async processProposal(
    agentContext: AgentContext,
    { attachment }: DidCommCredentialFormatProcessOptions
  ): Promise<void> {
    this.ensureWarningLoggedOnce(agentContext)
    const proposalJson = attachment.getDataAsJson()

    JsonTransformer.fromJSON(proposalJson, AnonCredsCredentialProposal)
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      attachmentId,
      credentialFormats,
      credentialExchangeRecord,
      proposalAttachment,
    }: DidCommCredentialFormatAcceptProposalOptions<LegacyIndyCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    this.ensureWarningLoggedOnce(agentContext)
    const indyFormat = credentialFormats?.indy

    const proposalJson = proposalAttachment.getDataAsJson<LegacyIndyDidCommCredentialProposalFormat>()
    const credentialDefinitionId = indyFormat?.credentialDefinitionId ?? proposalJson.cred_def_id

    const attributes = indyFormat?.attributes ?? credentialExchangeRecord.credentialAttributes

    if (!credentialDefinitionId) {
      throw new CredoError('No credential definition id in proposal or provided as input to accept proposal method.')
    }

    if (!isUnqualifiedCredentialDefinitionId(credentialDefinitionId)) {
      throw new CredoError(`${credentialDefinitionId} is not a valid legacy indy credential definition id`)
    }

    if (!attributes) {
      throw new CredoError('No attributes in proposal or provided as input to accept proposal method.')
    }

    const { format, attachment, previewAttributes } = await this.createIndyOffer(agentContext, {
      credentialExchangeRecord,
      attachmentId,
      attributes,
      credentialDefinitionId,
    })

    return { format, attachment, previewAttributes }
  }

  /**
   * Create a credential attachment format for a credential request.
   *
   * @param options The object containing all the options for the credential offer
   * @returns object containing associated attachment, formats and offersAttach elements
   *
   */
  public async createOffer(
    agentContext: AgentContext,
    {
      credentialFormats,
      credentialExchangeRecord,
      attachmentId,
    }: DidCommCredentialFormatCreateOfferOptions<LegacyIndyCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    this.ensureWarningLoggedOnce(agentContext)
    const indyFormat = credentialFormats.indy

    if (!indyFormat) {
      throw new CredoError('Missing indy credentialFormat data')
    }

    const { format, attachment, previewAttributes } = await this.createIndyOffer(agentContext, {
      credentialExchangeRecord,
      attachmentId,
      attributes: indyFormat.attributes,
      credentialDefinitionId: indyFormat.credentialDefinitionId,
    })

    return { format, attachment, previewAttributes }
  }

  public async processOffer(
    agentContext: AgentContext,
    { attachment, credentialExchangeRecord }: DidCommCredentialFormatProcessOptions
  ) {
    this.ensureWarningLoggedOnce(agentContext)
    agentContext.config.logger.debug(
      `Processing indy credential offer for credential record ${credentialExchangeRecord.id}`
    )

    const credOffer = attachment.getDataAsJson<AnonCredsCredentialOffer>()

    if (!isUnqualifiedSchemaId(credOffer.schema_id) || !isUnqualifiedCredentialDefinitionId(credOffer.cred_def_id)) {
      throw new DidCommProblemReportError('Invalid credential offer', {
        problemCode: DidCommCredentialProblemReportReason.IssuanceAbandoned,
      })
    }
  }

  public async acceptOffer(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      attachmentId,
      offerAttachment,
      credentialFormats,
    }: DidCommCredentialFormatAcceptOfferOptions<LegacyIndyCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    this.ensureWarningLoggedOnce(agentContext)
    const holderService = agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const credentialOffer = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()

    if (!isUnqualifiedCredentialDefinitionId(credentialOffer.cred_def_id)) {
      throw new CredoError(`${credentialOffer.cred_def_id} is not a valid legacy indy credential definition id`)
    }
    // Get credential definition
    const { credentialDefinition } = await fetchCredentialDefinition(agentContext, credentialOffer.cred_def_id)

    const { credentialRequest, credentialRequestMetadata } = await holderService.createCredentialRequest(agentContext, {
      credentialOffer,
      credentialDefinition,
      linkSecretId: credentialFormats?.indy?.linkSecretId,
      useLegacyProverDid: true,
    })

    if (!credentialRequest.prover_did) {
      // We just generate a prover did like string, as it's not used for anything and we don't need
      // to prove ownership of the did. It's deprecated in AnonCreds v1, but kept for backwards compatibility
      credentialRequest.prover_did = generateLegacyProverDidLikeString()
    }

    credentialExchangeRecord.metadata.set<AnonCredsCredentialRequestMetadata>(
      AnonCredsCredentialRequestMetadataKey,
      credentialRequestMetadata
    )
    credentialExchangeRecord.metadata.set<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
      credentialDefinitionId: credentialOffer.cred_def_id,
      schemaId: credentialOffer.schema_id,
    })

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: INDY_CRED_REQUEST,
    })

    const attachment = this.getFormatData(credentialRequest, format.attachmentId)
    return { format, attachment }
  }

  /**
   * Starting from a request is not supported for indy credentials, this method only throws an error.
   */
  public async createRequest(): Promise<DidCommCredentialFormatCreateReturn> {
    throw new CredoError('Starting from a request is not supported for indy credentials')
  }

  /**
   * We don't have any models to validate an indy request object, for now this method does nothing
   */
  public async processRequest(
    agentContext: AgentContext,
    _options: DidCommCredentialFormatProcessOptions
  ): Promise<void> {
    this.ensureWarningLoggedOnce(agentContext)
    // not needed for Indy
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      attachmentId,
      offerAttachment,
      requestAttachment,
    }: DidCommCredentialFormatAcceptRequestOptions<LegacyIndyCredentialFormat>
  ): Promise<DidCommCredentialFormatCreateReturn> {
    this.ensureWarningLoggedOnce(agentContext)
    // Assert credential attributes
    const credentialAttributes = credentialExchangeRecord.credentialAttributes
    if (!credentialAttributes) {
      throw new CredoError(
        `Missing required credential attribute values on credential record with id ${credentialExchangeRecord.id}`
      )
    }

    const anonCredsIssuerService =
      agentContext.dependencyManager.resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)

    const credentialOffer = offerAttachment?.getDataAsJson<AnonCredsCredentialOffer>()
    if (!credentialOffer) throw new CredoError('Missing indy credential offer in createCredential')

    const credentialRequest = requestAttachment.getDataAsJson<AnonCredsCredentialRequest>()
    if (!credentialRequest) throw new CredoError('Missing indy credential request in createCredential')

    const { credential } = await anonCredsIssuerService.createCredential(agentContext, {
      credentialOffer,
      credentialRequest,
      credentialValues: convertAttributesToCredentialValues(credentialAttributes),
    })

    const format = new DidCommCredentialFormatSpec({
      attachmentId,
      format: INDY_CRED,
    })

    const attachment = this.getFormatData(credential, format.attachmentId)
    return { format, attachment }
  }

  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialExchangeRecord the credential exchange record for this credential
   */
  public async processCredential(
    agentContext: AgentContext,
    { credentialExchangeRecord, attachment }: DidCommCredentialFormatProcessCredentialOptions
  ): Promise<void> {
    this.ensureWarningLoggedOnce(agentContext)
    const credentialRequestMetadata = credentialExchangeRecord.metadata.get<AnonCredsCredentialRequestMetadata>(
      AnonCredsCredentialRequestMetadataKey
    )

    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    if (!credentialRequestMetadata) {
      throw new CredoError(
        `Missing required request metadata for credential exchange with thread id with id ${credentialExchangeRecord.id}`
      )
    }

    if (!credentialExchangeRecord.credentialAttributes) {
      throw new CredoError('Missing credential attributes on credential record. Unable to check credential attributes')
    }

    const anonCredsCredential = attachment.getDataAsJson<AnonCredsCredential>()

    const { credentialDefinition, credentialDefinitionId } = await fetchCredentialDefinition(
      agentContext,
      anonCredsCredential.cred_def_id
    )

    const { schema, indyNamespace } = await fetchSchema(agentContext, anonCredsCredential.schema_id)

    // Resolve revocation registry if credential is revocable
    const revocationRegistryResult = anonCredsCredential.rev_reg_id
      ? await fetchRevocationRegistryDefinition(agentContext, anonCredsCredential.rev_reg_id)
      : undefined

    // assert the credential values match the offer values
    const recordCredentialValues = convertAttributesToCredentialValues(credentialExchangeRecord.credentialAttributes)
    assertCredentialValuesMatch(anonCredsCredential.values, recordCredentialValues)

    const storeCredentialOptions = getStoreCredentialOptions(
      {
        credential: anonCredsCredential,
        credentialRequestMetadata,
        credentialDefinition,
        schema,
        credentialDefinitionId,
        revocationRegistry: revocationRegistryResult?.revocationRegistryDefinition
          ? {
              id: revocationRegistryResult.revocationRegistryDefinitionId,
              definition: revocationRegistryResult.revocationRegistryDefinition,
            }
          : undefined,
      },
      indyNamespace
    )

    const credentialId = await anonCredsHolderService.storeCredential(agentContext, storeCredentialOptions)

    // If the credential is revocable, store the revocation identifiers in the credential record
    if (anonCredsCredential.rev_reg_id) {
      const credential = await anonCredsHolderService.getCredential(agentContext, { id: credentialId })

      credentialExchangeRecord.metadata.add<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
        credentialRevocationId: credential.credentialRevocationId ?? undefined,
        revocationRegistryId: credential.revocationRegistryId ?? undefined,
      })
      credentialExchangeRecord.setTags({
        anonCredsRevocationRegistryId: credential.revocationRegistryId,
        anonCredsUnqualifiedRevocationRegistryId: anonCredsCredential.rev_reg_id,
        anonCredsCredentialRevocationId: credential.credentialRevocationId,
      })
    }

    credentialExchangeRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: credentialId,
    })
  }

  public supportsFormat(format: string): boolean {
    const supportedFormats = [INDY_CRED_ABSTRACT, INDY_CRED_REQUEST, INDY_CRED_FILTER, INDY_CRED]

    return supportedFormats.includes(format)
  }

  /**
   * Gets the attachment object for a given attachmentId. We need to get out the correct attachmentId for
   * indy and then find the corresponding attachment (if there is one)
   * @param formats the formats object containing the attachmentId
   * @param messageAttachments the attachments containing the payload
   * @returns The DidCommAttachment if found or undefined
   *
   */
  public getAttachment(
    formats: DidCommCredentialFormatSpec[],
    messageAttachments: DidCommAttachment[]
  ): DidCommAttachment | undefined {
    const supportedAttachmentIds = formats.filter((f) => this.supportsFormat(f.format)).map((f) => f.attachmentId)
    const supportedAttachment = messageAttachments.find((attachment) => supportedAttachmentIds.includes(attachment.id))

    return supportedAttachment
  }

  public async deleteCredentialById(agentContext: AgentContext, credentialRecordId: string): Promise<void> {
    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    await anonCredsHolderService.deleteCredential(agentContext, credentialRecordId)
  }

  public async shouldAutoRespondToProposal(
    _agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: DidCommCredentialFormatAutoRespondProposalOptions
  ) {
    const proposalJson = proposalAttachment.getDataAsJson<LegacyIndyDidCommCredentialProposalFormat>()
    const offerJson = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()

    // We want to make sure the credential definition matches.
    // TODO: If no credential definition is present on the proposal, we could check whether the other fields
    // of the proposal match with the credential definition id.
    return proposalJson.cred_def_id === offerJson.cred_def_id
  }

  public async shouldAutoRespondToOffer(
    _agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: DidCommCredentialFormatAutoRespondOfferOptions
  ) {
    const proposalJson = proposalAttachment.getDataAsJson<LegacyIndyDidCommCredentialProposalFormat>()
    const offerJson = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()

    // We want to make sure the credential definition matches.
    // TODO: If no credential definition is present on the proposal, we could check whether the other fields
    // of the proposal match with the credential definition id.
    return proposalJson.cred_def_id === offerJson.cred_def_id
  }

  public async shouldAutoRespondToRequest(
    _agentContext: AgentContext,
    { offerAttachment, requestAttachment }: DidCommCredentialFormatAutoRespondRequestOptions
  ) {
    const credentialOfferJson = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()
    const credentialRequestJson = requestAttachment.getDataAsJson<AnonCredsCredentialRequest>()

    return credentialOfferJson.cred_def_id === credentialRequestJson.cred_def_id
  }

  public async shouldAutoRespondToCredential(
    _agentContext: AgentContext,
    {
      credentialExchangeRecord,
      requestAttachment,
      credentialAttachment,
    }: DidCommCredentialFormatAutoRespondCredentialOptions
  ) {
    const credentialJson = credentialAttachment.getDataAsJson<AnonCredsCredential>()
    const credentialRequestJson = requestAttachment.getDataAsJson<AnonCredsCredentialRequest>()

    // make sure the credential definition matches
    if (credentialJson.cred_def_id !== credentialRequestJson.cred_def_id) return false

    // If we don't have any attributes stored we can't compare so always return false.
    if (!credentialExchangeRecord.credentialAttributes) return false
    const attributeValues = convertAttributesToCredentialValues(credentialExchangeRecord.credentialAttributes)

    // check whether the values match the values in the record
    return checkCredentialValuesMatch(attributeValues, credentialJson.values)
  }

  private async createIndyOffer(
    agentContext: AgentContext,
    {
      credentialExchangeRecord,
      attachmentId,
      credentialDefinitionId,
      attributes,
    }: {
      credentialDefinitionId: string
      credentialExchangeRecord: DidCommCredentialExchangeRecord
      attachmentId?: string
      attributes: DidCommCredentialPreviewAttributeOptions[]
    }
  ): Promise<DidCommCredentialFormatCreateOfferReturn> {
    const anonCredsIssuerService =
      agentContext.dependencyManager.resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)

    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const format = new DidCommCredentialFormatSpec({
      attachmentId: attachmentId,
      format: INDY_CRED_ABSTRACT,
    })

    const offer = await anonCredsIssuerService.createCredentialOffer(agentContext, {
      credentialDefinitionId,
    })

    await this.assertPreviewAttributesMatchSchemaAttributes(agentContext, offer, attributes)

    credentialExchangeRecord.metadata.set<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
      schemaId: offer.schema_id,
      credentialDefinitionId: offer.cred_def_id,
    })

    const attachment = this.getFormatData(offer, format.attachmentId)

    return { format, attachment, previewAttributes: attributes }
  }

  private async assertPreviewAttributesMatchSchemaAttributes(
    agentContext: AgentContext,
    offer: AnonCredsCredentialOffer,
    attributes: DidCommCredentialPreviewAttributeOptions[]
  ): Promise<void> {
    const { schema } = await fetchSchema(agentContext, offer.schema_id)
    assertAttributesMatch(schema, attributes)
  }

  /**
   * Returns an object of type {@link DidCommAttachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   */
  public getFormatData(data: unknown, id: string): DidCommAttachment {
    const attachment = new DidCommAttachment({
      id,
      mimeType: 'application/json',
      data: {
        base64: JsonEncoder.toBase64(data),
      },
    })

    return attachment
  }
}
