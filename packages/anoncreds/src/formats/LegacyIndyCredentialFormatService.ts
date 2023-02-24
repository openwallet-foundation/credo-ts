import type { LegacyIndyCredentialFormat, LegacyIndyCredentialProposalFormat } from './LegacyIndyCredentialFormat'
import type {
  AnonCredsCredential,
  AnonCredsCredentialOffer,
  AnonCredsCredentialRequest,
  AnonCredsCredentialRequestMetadata,
} from '../models'
import type { AnonCredsIssuerService, AnonCredsHolderService, GetRevocationRegistryDefinitionReturn } from '../services'
import type { AnonCredsCredentialMetadata } from '../utils/metadata'
import type {
  CredentialFormatService,
  AgentContext,
  CredentialFormatCreateProposalOptions,
  CredentialFormatCreateProposalReturn,
  CredentialFormatProcessOptions,
  CredentialFormatAcceptProposalOptions,
  CredentialFormatCreateOfferReturn,
  CredentialFormatCreateOfferOptions,
  CredentialFormatAcceptOfferOptions,
  CredentialFormatCreateReturn,
  CredentialFormatAcceptRequestOptions,
  CredentialFormatProcessCredentialOptions,
  CredentialFormatAutoRespondProposalOptions,
  CredentialFormatAutoRespondOfferOptions,
  CredentialFormatAutoRespondRequestOptions,
  CredentialFormatAutoRespondCredentialOptions,
  CredentialExchangeRecord,
  CredentialPreviewAttributeOptions,
  LinkedAttachment,
} from '@aries-framework/core'

import {
  ProblemReportError,
  MessageValidator,
  CredentialFormatSpec,
  AriesFrameworkError,
  Attachment,
  JsonEncoder,
  utils,
  CredentialProblemReportReason,
  JsonTransformer,
} from '@aries-framework/core'

import { AnonCredsError } from '../error'
import { AnonCredsCredentialProposal } from '../models/AnonCredsCredentialProposal'
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
import { generateLegacyProverDidLikeString } from '../utils/proverDid'

const INDY_CRED_ABSTRACT = 'hlindy/cred-abstract@v2.0'
const INDY_CRED_REQUEST = 'hlindy/cred-req@v2.0'
const INDY_CRED_FILTER = 'hlindy/cred-filter@v2.0'
const INDY_CRED = 'hlindy/cred@v2.0'

export class LegacyIndyCredentialFormatService implements CredentialFormatService<LegacyIndyCredentialFormat> {
  /** formatKey is the key used when calling agent.credentials.xxx with credentialFormats.indy */
  public readonly formatKey = 'indy' as const

  /**
   * credentialRecordType is the type of record that stores the credential. It is stored in the credential
   * record binding in the credential exchange record.
   */
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
    { credentialFormats, credentialRecord }: CredentialFormatCreateProposalOptions<LegacyIndyCredentialFormat>
  ): Promise<CredentialFormatCreateProposalReturn> {
    const format = new CredentialFormatSpec({
      format: INDY_CRED_FILTER,
    })

    const indyFormat = credentialFormats.indy

    if (!indyFormat) {
      throw new AriesFrameworkError('Missing indy payload in createProposal')
    }

    // We want all properties except for `attributes` and `linkedAttachments` attributes.
    // The easiest way is to destructure and use the spread operator. But that leaves the other properties unused
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { attributes, linkedAttachments, ...indyCredentialProposal } = indyFormat
    const proposal = new AnonCredsCredentialProposal(indyCredentialProposal)

    try {
      MessageValidator.validateSync(proposal)
    } catch (error) {
      throw new AriesFrameworkError(`Invalid proposal supplied: ${indyCredentialProposal} in Indy Format Service`)
    }

    const attachment = this.getFormatData(JsonTransformer.toJSON(proposal), format.attachmentId)

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

  public async processProposal(
    agentContext: AgentContext,
    { attachment }: CredentialFormatProcessOptions
  ): Promise<void> {
    const proposalJson = attachment.getDataAsJson()

    JsonTransformer.fromJSON(proposalJson, AnonCredsCredentialProposal)
  }

  public async acceptProposal(
    agentContext: AgentContext,
    {
      attachmentId,
      credentialFormats,
      credentialRecord,
      proposalAttachment,
    }: CredentialFormatAcceptProposalOptions<LegacyIndyCredentialFormat>
  ): Promise<CredentialFormatCreateOfferReturn> {
    const indyFormat = credentialFormats?.indy

    const proposalJson = proposalAttachment.getDataAsJson<LegacyIndyCredentialProposalFormat>()
    const credentialDefinitionId = indyFormat?.credentialDefinitionId ?? proposalJson.cred_def_id

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
      attachmentId,
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
    {
      credentialFormats,
      credentialRecord,
      attachmentId,
    }: CredentialFormatCreateOfferOptions<LegacyIndyCredentialFormat>
  ): Promise<CredentialFormatCreateOfferReturn> {
    const indyFormat = credentialFormats.indy

    if (!indyFormat) {
      throw new AriesFrameworkError('Missing indy credentialFormat data')
    }

    const { format, attachment, previewAttributes } = await this.createIndyOffer(agentContext, {
      credentialRecord,
      attachmentId,
      attributes: indyFormat.attributes,
      credentialDefinitionId: indyFormat.credentialDefinitionId,
      linkedAttachments: indyFormat.linkedAttachments,
    })

    return { format, attachment, previewAttributes }
  }

  public async processOffer(
    agentContext: AgentContext,
    { attachment, credentialRecord }: CredentialFormatProcessOptions
  ) {
    agentContext.config.logger.debug(`Processing indy credential offer for credential record ${credentialRecord.id}`)

    const credOffer = attachment.getDataAsJson<AnonCredsCredentialOffer>()

    if (!credOffer.schema_id || !credOffer.cred_def_id) {
      throw new ProblemReportError('Invalid credential offer', {
        problemCode: CredentialProblemReportReason.IssuanceAbandoned,
      })
    }
  }

  public async acceptOffer(
    agentContext: AgentContext,
    {
      credentialRecord,
      attachmentId,
      offerAttachment,
      credentialFormats,
    }: CredentialFormatAcceptOfferOptions<LegacyIndyCredentialFormat>
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
      linkSecretId: credentialFormats?.indy?.linkSecretId,
    })

    if (!credentialRequest.prover_did) {
      // We just generate a prover did like string, as it's not used for anything and we don't need
      // to prove ownership of the did. It's deprecated in AnonCreds v1, but kept for backwards compatibility
      credentialRequest.prover_did = generateLegacyProverDidLikeString()
    }

    credentialRecord.metadata.set<AnonCredsCredentialRequestMetadata>(
      AnonCredsCredentialRequestMetadataKey,
      credentialRequestMetadata
    )
    credentialRecord.metadata.set<AnonCredsCredentialMetadata>(AnonCredsCredentialMetadataKey, {
      credentialDefinitionId: credentialOffer.cred_def_id,
      schemaId: credentialOffer.schema_id,
    })

    const format = new CredentialFormatSpec({
      attachmentId,
      format: INDY_CRED_REQUEST,
    })

    const attachment = this.getFormatData(credentialRequest, format.attachmentId)
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
  public async processRequest(agentContext: AgentContext, options: CredentialFormatProcessOptions): Promise<void> {
    // not needed for Indy
  }

  public async acceptRequest(
    agentContext: AgentContext,
    {
      credentialRecord,
      attachmentId,
      offerAttachment,
      requestAttachment,
    }: CredentialFormatAcceptRequestOptions<LegacyIndyCredentialFormat>
  ): Promise<CredentialFormatCreateReturn> {
    // Assert credential attributes
    const credentialAttributes = credentialRecord.credentialAttributes
    if (!credentialAttributes) {
      throw new AriesFrameworkError(
        `Missing required credential attribute values on credential record with id ${credentialRecord.id}`
      )
    }

    const anonCredsIssuerService =
      agentContext.dependencyManager.resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)

    const credentialOffer = offerAttachment?.getDataAsJson<AnonCredsCredentialOffer>()
    if (!credentialOffer) throw new AriesFrameworkError('Missing indy credential offer in createCredential')

    const credentialRequest = requestAttachment.getDataAsJson<AnonCredsCredentialRequest>()
    if (!credentialRequest) throw new AriesFrameworkError('Missing indy credential request in createCredential')

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
      credentialRecord.setTags({
        anonCredsRevocationRegistryId: credential.rev_reg_id,
        anonCredsCredentialRevocationId: credentialRevocationId,
      })
    }

    const format = new CredentialFormatSpec({
      attachmentId,
      format: INDY_CRED,
    })

    const attachment = this.getFormatData(credential, format.attachmentId)
    return { format, attachment }
  }

  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialRecord the credential exchange record for this credential
   */
  public async processCredential(
    agentContext: AgentContext,
    { credentialRecord, attachment }: CredentialFormatProcessCredentialOptions
  ): Promise<void> {
    const credentialRequestMetadata = credentialRecord.metadata.get<AnonCredsCredentialRequestMetadata>(
      AnonCredsCredentialRequestMetadataKey
    )

    const registryService = agentContext.dependencyManager.resolve(AnonCredsRegistryService)
    const anonCredsHolderService =
      agentContext.dependencyManager.resolve<AnonCredsHolderService>(AnonCredsHolderServiceSymbol)

    if (!credentialRequestMetadata) {
      throw new AriesFrameworkError(
        `Missing required request metadata for credential exchange with thread id with id ${credentialRecord.id}`
      )
    }

    if (!credentialRecord.credentialAttributes) {
      throw new AriesFrameworkError(
        'Missing credential attributes on credential record. Unable to check credential attributes'
      )
    }

    const anonCredsCredential = attachment.getDataAsJson<AnonCredsCredential>()

    const credentialDefinitionResult = await registryService
      .getRegistryForIdentifier(agentContext, anonCredsCredential.cred_def_id)
      .getCredentialDefinition(agentContext, anonCredsCredential.cred_def_id)
    if (!credentialDefinitionResult.credentialDefinition) {
      throw new AriesFrameworkError(
        `Unable to resolve credential definition ${anonCredsCredential.cred_def_id}: ${credentialDefinitionResult.resolutionMetadata.error} ${credentialDefinitionResult.resolutionMetadata.message}`
      )
    }

    const schemaResult = await registryService
      .getRegistryForIdentifier(agentContext, anonCredsCredential.cred_def_id)
      .getSchema(agentContext, anonCredsCredential.schema_id)
    if (!schemaResult.schema) {
      throw new AriesFrameworkError(
        `Unable to resolve schema ${anonCredsCredential.schema_id}: ${schemaResult.resolutionMetadata.error} ${schemaResult.resolutionMetadata.message}`
      )
    }

    // Resolve revocation registry if credential is revocable
    let revocationRegistryResult: null | GetRevocationRegistryDefinitionReturn = null
    if (anonCredsCredential.rev_reg_id) {
      revocationRegistryResult = await registryService
        .getRegistryForIdentifier(agentContext, anonCredsCredential.rev_reg_id)
        .getRevocationRegistryDefinition(agentContext, anonCredsCredential.rev_reg_id)

      if (!revocationRegistryResult.revocationRegistryDefinition) {
        throw new AriesFrameworkError(
          `Unable to resolve revocation registry definition ${anonCredsCredential.rev_reg_id}: ${revocationRegistryResult.resolutionMetadata.error} ${revocationRegistryResult.resolutionMetadata.message}`
        )
      }
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
      schema: schemaResult.schema,
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
        revocationRegistryId: credential.revocationRegistryId,
      })
      credentialRecord.setTags({
        anonCredsRevocationRegistryId: credential.revocationRegistryId,
        anonCredsCredentialRevocationId: credential.credentialRevocationId,
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
   * Gets the attachment object for a given attachmentId. We need to get out the correct attachmentId for
   * indy and then find the corresponding attachment (if there is one)
   * @param formats the formats object containing the attachmentId
   * @param messageAttachments the attachments containing the payload
   * @returns The Attachment if found or undefined
   *
   */
  public getAttachment(formats: CredentialFormatSpec[], messageAttachments: Attachment[]): Attachment | undefined {
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
    agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: CredentialFormatAutoRespondProposalOptions
  ) {
    const proposalJson = proposalAttachment.getDataAsJson<LegacyIndyCredentialProposalFormat>()
    const offerJson = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()

    // We want to make sure the credential definition matches.
    // TODO: If no credential definition is present on the proposal, we could check whether the other fields
    // of the proposal match with the credential definition id.
    return proposalJson.cred_def_id === offerJson.cred_def_id
  }

  public async shouldAutoRespondToOffer(
    agentContext: AgentContext,
    { offerAttachment, proposalAttachment }: CredentialFormatAutoRespondOfferOptions
  ) {
    const proposalJson = proposalAttachment.getDataAsJson<LegacyIndyCredentialProposalFormat>()
    const offerJson = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()

    // We want to make sure the credential definition matches.
    // TODO: If no credential definition is present on the proposal, we could check whether the other fields
    // of the proposal match with the credential definition id.
    return proposalJson.cred_def_id === offerJson.cred_def_id
  }

  public async shouldAutoRespondToRequest(
    agentContext: AgentContext,
    { offerAttachment, requestAttachment }: CredentialFormatAutoRespondRequestOptions
  ) {
    const credentialOfferJson = offerAttachment.getDataAsJson<AnonCredsCredentialOffer>()
    const credentialRequestJson = requestAttachment.getDataAsJson<AnonCredsCredentialRequest>()

    return credentialOfferJson.cred_def_id === credentialRequestJson.cred_def_id
  }

  public async shouldAutoRespondToCredential(
    agentContext: AgentContext,
    { credentialRecord, requestAttachment, credentialAttachment }: CredentialFormatAutoRespondCredentialOptions
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
      attachmentId,
      credentialDefinitionId,
      attributes,
      linkedAttachments,
    }: {
      credentialDefinitionId: string
      credentialRecord: CredentialExchangeRecord
      attachmentId?: string
      attributes: CredentialPreviewAttributeOptions[]
      linkedAttachments?: LinkedAttachment[]
    }
  ): Promise<CredentialFormatCreateOfferReturn> {
    const anonCredsIssuerService =
      agentContext.dependencyManager.resolve<AnonCredsIssuerService>(AnonCredsIssuerServiceSymbol)

    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const format = new CredentialFormatSpec({
      attachmentId: attachmentId,
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

    const attachment = this.getFormatData(offer, format.attachmentId)

    return { format, attachment, previewAttributes }
  }

  private async assertPreviewAttributesMatchSchemaAttributes(
    agentContext: AgentContext,
    offer: AnonCredsCredentialOffer,
    attributes: CredentialPreviewAttributeOptions[]
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
    previewAttributes?: CredentialPreviewAttributeOptions[]
  } {
    if (!linkedAttachments && !attributes) {
      return {}
    }

    let previewAttributes = attributes ?? []
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
      data: {
        base64: JsonEncoder.toBase64(data),
      },
    })

    return attachment
  }
}
