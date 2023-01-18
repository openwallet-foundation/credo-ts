import type { LegacyIndyCredentialFormat } from './LegacyIndyCredentialFormat'
import type {
  AnonCredsCredential,
  AnonCredsCredentialOffer,
  AnonCredsCredentialRequest,
  AnonCredsCredentialRequestMetadata,
} from '../models'
import type { AnonCredsIssuerService, AnonCredsHolderService } from '../services'
import type { AnonCredsCredentialMetadata } from '../utils/metadata'
import type {
  CredentialFormatService,
  AgentContext,
  FormatCreateProposalOptions,
  FormatCreateProposalReturn,
  FormatProcessOptions,
  FormatAcceptProposalOptions,
  FormatCreateOfferReturn,
  FormatCreateOfferOptions,
  FormatAcceptOfferOptions,
  CredentialFormatCreateReturn,
  FormatAcceptRequestOptions,
  FormatProcessCredentialOptions,
  FormatAutoRespondProposalOptions,
  FormatAutoRespondOfferOptions,
  FormatAutoRespondRequestOptions,
  FormatAutoRespondCredentialOptions,
  CredentialExchangeRecord,
  CredentialPreviewAttributeOptions,
  LinkedAttachment,
} from '@aries-framework/core'

import {
  CredentialFormatSpec,
  AriesFrameworkError,
  IndyCredPropose,
  JsonTransformer,
  Attachment,
  CredentialPreviewAttribute,
  AttachmentData,
  JsonEncoder,
  utils,
  MessageValidator,
  CredentialProblemReportError,
  CredentialProblemReportReason,
} from '@aries-framework/core'

import { AnonCredsError } from '../error'
import { AnonCredsIssuerServiceSymbol, AnonCredsHolderServiceSymbol } from '../services'
import { AnonCredsRegistryService } from '../services/registry/AnonCredsRegistryService'
import {
  convertAttributesToCredentialValues,
  assertCredentialValuesMatch,
  checkCredentialValuesMatch,
  assertAttributesMatch,
  createAndLinkAttachmentsToPreview,
} from '../utils/credential'
import { AnonCredsCredentialMetadataKey, AnonCredsCredentialRequestMetadataKey } from '../utils/metadata'

const INDY_CRED_ABSTRACT = 'hlindy/cred-abstract@v2.0'
const INDY_CRED_REQUEST = 'hlindy/cred-req@v2.0'
const INDY_CRED_FILTER = 'hlindy/cred-filter@v2.0'
const INDY_CRED = 'hlindy/cred@v2.0'

export class LegacyIndyCredentialFormatService implements CredentialFormatService<LegacyIndyCredentialFormat> {
  public readonly formatKey = 'indy' as const
  public readonly credentialRecordType = 'anoncreds' as const

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the proposed credential
   * @returns object containing associated attachment, format and optionally the credential preview
   *
   */
  public async createProposal(
    agentContext: AgentContext,
    { credentialFormats, credentialRecord }: FormatCreateProposalOptions<LegacyIndyCredentialFormat>
  ): Promise<FormatCreateProposalReturn> {
    const format = new CredentialFormatSpec({
      format: INDY_CRED_FILTER,
    })

    const indyFormat = credentialFormats.indy

    if (!indyFormat) {
      throw new AriesFrameworkError('Missing indy payload in createProposal')
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { attributes, linkedAttachments, ...indyCredentialProposal } = indyFormat

    const proposal = new IndyCredPropose(indyCredentialProposal)

    try {
      MessageValidator.validateSync(proposal)
    } catch (error) {
      throw new AriesFrameworkError(`Invalid proposal supplied: ${indyCredentialProposal} in Indy Format Service`)
    }

    const proposalJson = JsonTransformer.toJSON(proposal)
    const attachment = this.getFormatData(proposalJson, format.attachId)

    const { previewAttributes } = this.getCredentialLinkedAttachments(
      indyFormat.attributes,
      indyFormat.linkedAttachments
    )

    // Set the metadata
    credentialRecord.metadata.set<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
      schemaId: proposal.schemaId,
      credentialDefinitionId: proposal.credentialDefinitionId,
    })

    return { format, attachment, previewAttributes }
  }

  public async processProposal(agentContext: AgentContext, { attachment }: FormatProcessOptions): Promise<void> {
    const proposalJson = attachment.getDataAsJson()

    // fromJSON also validates
    JsonTransformer.fromJSON(proposalJson, IndyCredPropose)
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      attachId,
      credentialFormats,
      credentialRecord,
      proposalAttachment,
    }: FormatAcceptProposalOptions<LegacyIndyCredentialFormat>
  ): Promise<FormatCreateOfferReturn> {
    const indyFormat = credentialFormats?.indy

    const credentialProposal = JsonTransformer.fromJSON(proposalAttachment.getDataAsJson(), IndyCredPropose)

    const credentialDefinitionId = indyFormat?.credentialDefinitionId ?? credentialProposal.credentialDefinitionId

    // TODO: we may want to extract the
    const attributes = indyFormat?.attributes ?? credentialRecord.credentialAttributes

    if (!credentialDefinitionId) {
      throw new AriesFrameworkError(
        'No credentialDefinitionId in proposal or provided as input to accept proposal method.'
      )
    }

    if (!attributes) {
      throw new AriesFrameworkError('No attributes in proposal or provided as input to accept proposal method.')
    }

    const { format, attachment, previewAttributes } = await this.createIndyOffer(agentContext, {
      credentialRecord,
      attachId,
      attributes,
      credentialDefinitionId,
      linkedAttachments: indyFormat?.linkedAttachments,
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
    { credentialFormats, credentialRecord, attachId }: FormatCreateOfferOptions<LegacyIndyCredentialFormat>
  ): Promise<FormatCreateOfferReturn> {
    const indyFormat = credentialFormats.indy

    if (!indyFormat) {
      throw new AriesFrameworkError('Missing indy credentialFormat data')
    }

    const { format, attachment, previewAttributes } = await this.createIndyOffer(agentContext, {
      credentialRecord,
      attachId,
      attributes: indyFormat.attributes,
      credentialDefinitionId: indyFormat.credentialDefinitionId,
      linkedAttachments: indyFormat.linkedAttachments,
    })

    return { format, attachment, previewAttributes }
  }

  public async processOffer(agentContext: AgentContext, { attachment, credentialRecord }: FormatProcessOptions) {
    agentContext.config.logger.debug(`Processing indy credential offer for credential record ${credentialRecord.id}`)

    const credOffer = attachment.getDataAsJson<AnonCredsCredentialOffer>()

    if (!credOffer.schema_id || !credOffer.cred_def_id) {
      throw new CredentialProblemReportError('Invalid credential offer', {
        problemCode: CredentialProblemReportReason.IssuanceAbandoned,
      })
    }
  }

  public async acceptOffer(
    agentContext: AgentContext,
    { credentialRecord, attachId, offerAttachment }: FormatAcceptOfferOptions<LegacyIndyCredentialFormat>
  ): Promise<CredentialFormatCreateReturn> {
    const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)
    const holderService = agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    const credentialOffer = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()

    // Get credential definition
    const registry = registryService.getRegistryForIdentifier(agentContext, credentialOffer.cred_def_id)
    const { credentialDefinition, resolutionMetadata } = await registry.getCredentialDefinition(
      agentContext,
      credentialOffer.cred_def_id
    )

    if (!credentialDefinition) {
      throw new AnonCredsError(
        `Unable to retrieve credential definition with id ${credentialOffer.cred_def_id}: ${resolutionMetadata.error} ${resolutionMetadata.message}`
      )
    }

    const { credentialRequest, credentialRequestMetadata } = await holderService.createCredentialRequest(agentContext, {
      credentialOffer,
      credentialDefinition,
    })

    credentialRecord.metadata.set<AnonCredsCredentialRequestMetadata>(
      AnonCredsCredentialRequestMetadataKey,
      credentialRequestMetadata
    )
    credentialRecord.metadata.set<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
      credentialDefinitionId: credentialOffer.cred_def_id,
      schemaId: credentialOffer.schema_id,
    })

    const format = new CredentialFormatSpec({
      attachId,
      format: INDY_CRED_REQUEST,
    })

    const attachment = this.getFormatData(credentialRequest, format.attachId)
    return { format, attachment }
  }

  /**
   * Starting from a request is not supported for indy credentials, this method only throws an error.
   */
  public async createRequest(): Promise<CredentialFormatCreateReturn> {
    throw new AriesFrameworkError('Starting from a request is not supported for indy credentials')
  }

  /**
   * We don't have any models to validate an indy request object, for now this method does nothing
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async processRequest(agentContext: AgentContext, options: FormatProcessOptions): Promise<void> {
    // not needed for Indy
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialRecord,
      attachId,
      offerAttachment,
      requestAttachment,
    }: FormatAcceptRequestOptions<LegacyIndyCredentialFormat>
  ): Promise<CredentialFormatCreateReturn> {
    // Assert credential attributes
    const credentialAttributes = credentialRecord.credentialAttributes
    if (!credentialAttributes) {
      throw new CredentialProblemReportError(
        `Missing required credential attribute values on credential record with id ${credentialRecord.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const anonCredsIssuerService =
      agentContext.dependencyManager.resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)

    const credentialOffer = offerAttachment?.getDataAsJson<AnonCredsCredentialOffer>()
    const credentialRequest = requestAttachment.getDataAsJson<AnonCredsCredentialRequest>()

    if (!credentialOffer || !credentialRequest) {
      throw new AriesFrameworkError('Missing indy credential offer or credential request in createCredential')
    }

    const { credential, credentialRevocationId } = await anonCredsIssuerService.createCredential(agentContext, {
      credentialOffer,
      credentialRequest,
      credentialValues: convertAttributesToCredentialValues(credentialAttributes),
    })

    if (credential.rev_reg_id) {
      credentialRecord.metadata.add<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
        credentialRevocationId: credentialRevocationId,
        revocationRegistryId: credential.rev_reg_id,
      })
    }

    const format = new CredentialFormatSpec({
      attachId,
      format: INDY_CRED,
    })

    const attachment = this.getFormatData(credential, format.attachId)
    return { format, attachment }
  }

  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialRecord the credential exchange record for this credential
   */
  public async processCredential(
    agentContext: AgentContext,
    { credentialRecord, attachment }: FormatProcessCredentialOptions
  ): Promise<void> {
    const credentialRequestMetadata = credentialRecord.metadata.get<AnonCredsCredentialRequestMetadata>(
      AnonCredsCredentialRequestMetadataKey
    )

    const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)
    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    if (!credentialRequestMetadata) {
      throw new CredentialProblemReportError(
        `Missing required request metadata for credential with id ${credentialRecord.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const anonCredsCredential = attachment.getDataAsJson<AnonCredsCredential>()

    // We can use the same registry for the credential definition and revocation registry as they MUST have the same issuerId
    const registry = registryService.getRegistryForIdentifier(agentContext, anonCredsCredential.cred_def_id)

    const credentialDefinitionResult = await registry.getCredentialDefinition(
      agentContext,
      anonCredsCredential.cred_def_id
    )
    if (!credentialDefinitionResult.credentialDefinition) {
      throw new AriesFrameworkError(
        `Unable to resolve credential definition ${anonCredsCredential.cred_def_id}: ${credentialDefinitionResult.resolutionMetadata.error} ${credentialDefinitionResult.resolutionMetadata.message}`
      )
    }

    const revocationRegistryResult = anonCredsCredential.rev_reg_id
      ? await registry.getRevocationRegistryDefinition(agentContext, anonCredsCredential.rev_reg_id)
      : null
    if (revocationRegistryResult && !revocationRegistryResult.revocationRegistryDefinition) {
      throw new AriesFrameworkError(
        `Unable to resolve revocation registry definition ${anonCredsCredential.cred_def_id}: ${credentialDefinitionResult.resolutionMetadata.error} ${credentialDefinitionResult.resolutionMetadata.message}`
      )
    }

    if (!credentialRecord.credentialAttributes) {
      throw new AriesFrameworkError(
        'Missing credential attributes on credential record. Unable to check credential attributes'
      )
    }

    // assert the credential values match the offer values
    const recordCredentialValues = convertAttributesToCredentialValues(credentialRecord.credentialAttributes)
    assertCredentialValuesMatch(anonCredsCredential.values, recordCredentialValues)

    const credentialId = await anonCredsHolderService.storeCredential(agentContext, {
      credentialId: utils.uuid(),
      credentialRequestMetadata,
      credential: anonCredsCredential,
      credentialDefinitionId: credentialDefinitionResult.credentialDefinitionId,
      credentialDefinition: credentialDefinitionResult.credentialDefinition,
      revocationRegistry: revocationRegistryResult?.revocationRegistryDefinition
        ? {
            definition: revocationRegistryResult.revocationRegistryDefinition,
            id: revocationRegistryResult.revocationRegistryDefinitionId,
          }
        : undefined,
    })

    // If the credential is revocable, store the revocation identifiers in the credential record
    if (anonCredsCredential.rev_reg_id) {
      const credential = await anonCredsHolderService.getCredential(agentContext, { credentialId })

      credentialRecord.metadata.add<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
        credentialRevocationId: credential.credentialRevocationId,
        revocationRegistryId: anonCredsCredential.rev_reg_id,
      })
    }

    credentialRecord.credentials.push({
      credentialRecordType: this.credentialRecordType,
      credentialRecordId: credentialId,
    })
  }

  public supportsFormat(format: string): boolean {
    const supportedFormats = [INDY_CRED_ABSTRACT, INDY_CRED_REQUEST, INDY_CRED_FILTER, INDY_CRED]

    return supportedFormats.includes(format)
  }

  /**
   * Gets the attachment object for a given attachId. We need to get out the correct attachId for
   * indy and then find the corresponding attachment (if there is one)
   * @param formats the formats object containing the attachId
   * @param messageAttachments the attachments containing the payload
   * @returns The Attachment if found or undefined
   *
   */
  public getAttachment(formats: CredentialFormatSpec[], messageAttachments: Attachment[]): Attachment | undefined {
    const supportedAttachmentIds = formats.filter((f) => this.supportsFormat(f.format)).map((f) => f.attachId)
    const supportedAttachments = messageAttachments.filter((attachment) =>
      supportedAttachmentIds.includes(attachment.id)
    )

    return supportedAttachments[0]
  }

  public async deleteCredentialById(agentContext: AgentContext, credentialRecordId: string): Promise<void> {
    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    await anonCredsHolderService.deleteCredential(agentContext, credentialRecordId)
  }

  public shouldAutoRespondToProposal(
    agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: FormatAutoRespondProposalOptions
  ) {
    const credentialProposalJson = proposalAttachment.getDataAsJson()
    const credentialProposal = JsonTransformer.fromJSON(credentialProposalJson, IndyCredPropose)

    const credentialOfferJson = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()

    // We want to make sure the credential definition matches.
    // TODO: If no credential definition is present on the proposal, we could check whether the other fields
    // of the proposal match with the credential definition id.
    return credentialProposal.credentialDefinitionId === credentialOfferJson.cred_def_id
  }

  public shouldAutoRespondToOffer(
    agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: FormatAutoRespondOfferOptions
  ) {
    const credentialProposalJson = proposalAttachment.getDataAsJson()
    const credentialProposal = JsonTransformer.fromJSON(credentialProposalJson, IndyCredPropose)

    const credentialOfferJson = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()

    // We want to make sure the credential definition matches.
    // TODO: If no credential definition is present on the proposal, we could check whether the other fields
    // of the proposal match with the credential definition id.
    return credentialProposal.credentialDefinitionId === credentialOfferJson.cred_def_id
  }

  public shouldAutoRespondToRequest(
    agentContext: AgentContext,
    { offerAttachment, requestAttachment }: FormatAutoRespondRequestOptions
  ) {
    const credentialOfferJson = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()
    const credentialRequestJson = requestAttachment.getDataAsJson<AnonCredsCredentialRequest>()

    return credentialOfferJson.cred_def_id == credentialRequestJson.cred_def_id
  }

  public shouldAutoRespondToCredential(
    agentContext: AgentContext,
    { credentialRecord, requestAttachment, credentialAttachment }: FormatAutoRespondCredentialOptions
  ) {
    const credentialJson = credentialAttachment.getDataAsJson<AnonCredsCredential>()
    const credentialRequestJson = requestAttachment.getDataAsJson<AnonCredsCredentialRequest>()

    // make sure the credential definition matches
    if (credentialJson.cred_def_id !== credentialRequestJson.cred_def_id) return false

    // If we don't have any attributes stored we can't compare so always return false.
    if (!credentialRecord.credentialAttributes) return false
    const attributeValues = convertAttributesToCredentialValues(credentialRecord.credentialAttributes)

    // check whether the values match the values in the record
    return checkCredentialValuesMatch(attributeValues, credentialJson.values)
  }

  private async createIndyOffer(
    agentContext: AgentContext,
    {
      credentialRecord,
      attachId,
      credentialDefinitionId,
      attributes,
      linkedAttachments,
    }: {
      credentialDefinitionId: string
      credentialRecord: CredentialExchangeRecord
      attachId?: string
      attributes: CredentialPreviewAttributeOptions[]
      linkedAttachments?: LinkedAttachment[]
    }
  ): Promise<FormatCreateOfferReturn> {
    const anonCredsIssuerService =
      agentContext.dependencyManager.resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)

    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const format = new CredentialFormatSpec({
      attachId: attachId,
      format: INDY_CRED_ABSTRACT,
    })

    const offer = await anonCredsIssuerService.createCredentialOffer(agentContext, {
      credentialDefinitionId,
    })

    const { previewAttributes } = this.getCredentialLinkedAttachments(attributes, linkedAttachments)
    if (!previewAttributes) {
      throw new AriesFrameworkError('Missing required preview attributes for indy offer')
    }

    await this.assertPreviewAttributesMatchSchemaAttributes(agentContext, offer, previewAttributes)

    credentialRecord.metadata.set<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
      schemaId: offer.schema_id,
      credentialDefinitionId: offer.cred_def_id,
    })

    const attachment = this.getFormatData(offer, format.attachId)

    return { format, attachment, previewAttributes }
  }

  private async assertPreviewAttributesMatchSchemaAttributes(
    agentContext: AgentContext,
    offer: AnonCredsCredentialOffer,
    attributes: CredentialPreviewAttribute[]
  ): Promise<void> {
    const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)
    const registry = registryService.getRegistryForIdentifier(agentContext, offer.schema_id)

    const schemaResult = await registry.getSchema(agentContext, offer.schema_id)

    if (!schemaResult.schema) {
      throw new AriesFrameworkError(
        `Unable to resolve schema ${offer.schema_id} from registry: ${schemaResult.resolutionMetadata.error} ${schemaResult.resolutionMetadata.message}`
      )
    }

    assertAttributesMatch(schemaResult.schema, attributes)
  }

  /**
   * Get linked attachments for indy format from a proposal message. This allows attachments
   * to be copied across to old style credential records
   *
   * @param options ProposeCredentialOptions object containing (optionally) the linked attachments
   * @return array of linked attachments or undefined if none present
   */
  private getCredentialLinkedAttachments(
    attributes?: CredentialPreviewAttributeOptions[],
    linkedAttachments?: LinkedAttachment[]
  ): {
    attachments?: Attachment[]
    previewAttributes?: CredentialPreviewAttribute[]
  } {
    if (!linkedAttachments && !attributes) {
      return {}
    }

    let previewAttributes = attributes?.map((attribute) => new CredentialPreviewAttribute(attribute)) ?? []
    let attachments: Attachment[] | undefined

    if (linkedAttachments) {
      // there are linked attachments so transform into the attribute field of the CredentialPreview object for
      // this proposal
      previewAttributes = createAndLinkAttachmentsToPreview(linkedAttachments, previewAttributes)
      attachments = linkedAttachments.map((linkedAttachment) => linkedAttachment.attachment)
    }

    return { attachments, previewAttributes }
  }

  /**
   * Returns an object of type {@link Attachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   */
  public getFormatData(data: unknown, id: string): Attachment {
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
