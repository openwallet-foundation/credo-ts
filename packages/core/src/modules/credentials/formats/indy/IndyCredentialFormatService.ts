import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { Logger } from '../../../../logger'
import type {
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../CredentialsModuleOptions'
import type {
  ServiceAcceptCredentialOptions,
  ServiceAcceptOfferOptions as ServiceOfferOptions,
  ServiceAcceptProposalOptions,
  ServiceAcceptRequestOptions,
  ServiceOfferCredentialOptions,
  ServiceRequestCredentialOptions,
} from '../../protocol'
import type { V1CredentialPreview } from '../../protocol/v1/V1CredentialPreview'
import type { CredentialExchangeRecord } from '../../repository/CredentialExchangeRecord'
import type {
  FormatServiceCredentialAttachmentFormats,
  HandlerAutoAcceptOptions,
  FormatServiceOfferAttachmentFormats,
  FormatServiceProposeAttachmentFormats,
  RevocationRegistry,
} from '../models/CredentialFormatServiceOptions'
import type { Cred, CredDef, CredOffer, CredReq, CredReqMetadata } from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../../agent/AgentConfig'
import { EventEmitter } from '../../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../../error'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import { uuid } from '../../../../utils/uuid'
import { IndyHolderService, IndyIssuerService } from '../../../indy'
import { IndyLedgerService } from '../../../ledger'
import { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import { CredentialUtils } from '../../CredentialUtils'
import { CredentialFormatType } from '../../CredentialsModuleOptions'
import { composeAutoAccept } from '../../composeAutoAccept'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../../errors'
import { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttribute'
import { V2CredentialPreview } from '../../protocol/v2/V2CredentialPreview'
import { CredentialMetadataKeys } from '../../repository/CredentialMetadataTypes'
import { CredentialRepository } from '../../repository/CredentialRepository'
import { CredentialFormatService } from '../CredentialFormatService'
import { CredPropose } from '../models/CredPropose'
import { CredentialFormatSpec } from '../models/CredentialFormatServiceOptions'

@scoped(Lifecycle.ContainerScoped)
export class IndyCredentialFormatService extends CredentialFormatService {
  private indyIssuerService: IndyIssuerService
  private indyLedgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  protected credentialRepository: CredentialRepository // protected as in base class
  private logger: Logger

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    indyIssuerService: IndyIssuerService,
    indyLedgerService: IndyLedgerService,
    indyHolderService: IndyHolderService,
    agentConfig: AgentConfig
  ) {
    super(credentialRepository, eventEmitter)
    this.credentialRepository = credentialRepository
    this.indyIssuerService = indyIssuerService
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
    this.logger = agentConfig.logger
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the proposed credential
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_PROPOSAL"
   * @returns object containing associated attachment, formats and filtersAttach elements
   *
   */
  public async createProposal(options: ProposeCredentialOptions): Promise<FormatServiceProposeAttachmentFormats> {
    const formats: CredentialFormatSpec = {
      attachId: this.generateId(),
      format: 'hlindy/cred-filter@v2.0',
    }

    if (!options.credentialFormats.indy?.payload) {
      throw new AriesFrameworkError('Missing payload in createProposal')
    }

    // Use class instance instead of interface, otherwise this causes interoperability problems
    let proposal = new CredPropose(options.credentialFormats.indy?.payload)

    try {
      await MessageValidator.validate(proposal)
    } catch (error) {
      throw new AriesFrameworkError(`Invalid credPropose class instance: ${proposal} in Indy Format Service`)
    }

    proposal = JsonTransformer.toJSON(proposal)

    const attachment = this.getFormatData(proposal, formats.attachId)

    const { previewWithAttachments } = this.getCredentialLinkedAttachments(options)

    return { format: formats, attachment, preview: previewWithAttachments }
  }

  public async processProposal(
    options: ServiceAcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    const credProposalJson = options.proposalAttachment?.getDataAsJson<CredPropose>()
    if (!credProposalJson) {
      throw new AriesFrameworkError('Missing indy credential proposal data payload')
    }
    const credProposal = JsonTransformer.fromJSON(credProposalJson, CredPropose)
    await MessageValidator.validate(credProposal)

    if (credProposal.credentialDefinitionId) {
      options.credentialFormats = {
        indy: {
          credentialDefinitionId: credProposal?.credentialDefinitionId,
          attributes: [],
        },
      }
    }

    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      schemaId: credProposal.schemaId,
      credentialDefinitionId: credProposal.credentialDefinitionId,
    })
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the credential offer
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_OFFER"
   * @returns object containing associated attachment, formats and offersAttach elements
   *
   */
  public async createOffer(options: ServiceOfferCredentialOptions): Promise<FormatServiceOfferAttachmentFormats> {
    const formats = new CredentialFormatSpec({
      attachId: this.generateId(),
      format: 'hlindy/cred-abstract@v2.0',
    })
    const offer = await this.createCredentialOffer(options)

    let preview: V2CredentialPreview | undefined

    if (options?.credentialFormats.indy?.attributes) {
      preview = new V2CredentialPreview({
        attributes: options?.credentialFormats.indy?.attributes.map(
          (attribute) => new CredentialPreviewAttribute(attribute)
        ),
      })
    }

    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const attachmentId = options.attachId ? options.attachId : formats.attachId

    const offersAttach: Attachment = this.getFormatData(offer, attachmentId)

    // with credential preview now being a required field (as per spec)
    // attributes could be empty
    if (preview && preview.attributes.length > 0) {
      await this.checkPreviewAttributesMatchSchemaAttributes(offersAttach, preview)
    }

    return { format: formats, attachment: offersAttach, preview }
  }
  public async processOffer(attachment: Attachment, credentialRecord: CredentialExchangeRecord) {
    if (!attachment) {
      throw new AriesFrameworkError('Missing offer attachment in processOffer')
    }
    this.logger.debug(`Save metadata for credential record ${credentialRecord.id}`)

    const credOffer: CredOffer = attachment.getDataAsJson<CredOffer>()

    credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
      schemaId: credOffer.schema_id,
      credentialDefinitionId: credOffer.cred_def_id,
    })
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param requestOptions The object containing all the options for the credential request
   * @param credentialRecord the credential record containing the offer from which this request
   * is derived
   * @returns object containing associated attachment, formats and requestAttach elements
   *
   */
  public async createRequest(
    options: ServiceRequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<FormatServiceCredentialAttachmentFormats> {
    if (!options.offerAttachment) {
      throw new AriesFrameworkError(
        `Missing attachment from offer message, credential record id = ${credentialRecord.id}`
      )
    }

    if (!options.holderDid) {
      throw new AriesFrameworkError(
        `Missing holder DID from offer message, credential record id = ${credentialRecord.id}`
      )
    }
    const offer = options.offerAttachment.getDataAsJson<CredOffer>()
    const credDef = await this.getCredentialDefinition(offer)

    const { credReq, credReqMetadata } = await this.createIndyCredentialRequest(offer, credDef, options.holderDid)
    credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, credReqMetadata)

    const formats = new CredentialFormatSpec({
      attachId: this.generateId(),
      format: 'hlindy/cred-req@v2.0',
    })

    const attachmentId = options.attachId ?? formats.attachId
    const requestAttach: Attachment = this.getFormatData(credReq, attachmentId)
    return { format: formats, attachment: requestAttach }
  }

  /**
   * Not implemented; there for future versions
   */
  public async processRequest(
    /* eslint-disable @typescript-eslint/no-unused-vars */
    _options: RequestCredentialOptions,
    _credentialRecord: CredentialExchangeRecord
    /* eslint-enable @typescript-eslint/no-unused-vars */
  ): Promise<void> {
    // not needed for Indy
  }

  private async getCredentialDefinition(credOffer: CredOffer): Promise<CredDef> {
    const indyCredDef = await this.indyLedgerService.getCredentialDefinition(credOffer.cred_def_id)
    return indyCredDef
  }

  /**
   * Get linked attachments for indy format from a proposal message. This allows attachments
   * to be copied across to old style credential records
   *
   * @param options ProposeCredentialOptions object containing (optionally) the linked attachments
   * @return array of linked attachments or undefined if none present
   */
  private getCredentialLinkedAttachments(options: ProposeCredentialOptions): {
    attachments: Attachment[] | undefined
    previewWithAttachments: V2CredentialPreview
  } {
    // Add the linked attachments to the credentialProposal
    if (!options.credentialFormats.indy?.payload) {
      throw new AriesFrameworkError('Missing payload in getCredentialLinkedAttachments')
    }

    let attachments: Attachment[] | undefined
    let previewWithAttachments: V2CredentialPreview | undefined
    if (options.credentialFormats.indy.attributes) {
      previewWithAttachments = new V2CredentialPreview({
        attributes: options.credentialFormats.indy.attributes.map(
          (attribute) => new CredentialPreviewAttribute(attribute)
        ),
      })
    }

    if (!options.credentialFormats.indy.attributes) {
      throw new AriesFrameworkError('Missing attributes from credential proposal')
    }

    if (options.credentialFormats.indy && options.credentialFormats.indy.linkedAttachments) {
      // there are linked attachments so transform into the attribute field of the CredentialPreview object for
      // this proposal
      previewWithAttachments = CredentialUtils.createAndLinkAttachmentsToPreview(
        options.credentialFormats.indy.linkedAttachments,
        new V2CredentialPreview({
          attributes: options.credentialFormats.indy.attributes.map(
            (attribute) => new CredentialPreviewAttribute(attribute)
          ),
        })
      )

      attachments = options.credentialFormats.indy.linkedAttachments.map(
        (linkedAttachment) => linkedAttachment.attachment
      )
    }
    if (!previewWithAttachments) {
      throw new AriesFrameworkError('No previewWithAttachments')
    }
    return { attachments, previewWithAttachments }
  }

  /**
   * Gets the attachment object for a given attachId. We need to get out the correct attachId for
   * indy and then find the corresponding attachment (if there is one)
   * @param formats the formats object containing the attachid
   * @param messageAttachment the attachment containing the payload
   * @returns The Attachment if found or undefined
   */

  public getAttachment(formats: CredentialFormatSpec[], messageAttachment: Attachment[]): Attachment | undefined {
    const formatId = formats.find((f) => f.format.includes('indy'))
    const attachment = messageAttachment?.find((attachment) => attachment.id === formatId?.attachId)
    return attachment
  }
  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param credentialDefinitionId The credential definition to create an offer for
   * @returns The created credential offer
   */
  private async createCredentialOffer(
    proposal: ServiceOfferOptions | NegotiateProposalOptions | OfferCredentialOptions
  ): Promise<CredOffer> {
    if (!proposal.credentialFormats?.indy?.credentialDefinitionId) {
      throw new AriesFrameworkError('Missing Credential Definition id')
    }
    const credOffer: CredOffer = await this.indyIssuerService.createCredentialOffer(
      proposal.credentialFormats.indy.credentialDefinitionId
    )
    return credOffer
  }

  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param options RequestCredentialOptions the config options for the credential request
   * @throws Error if unable to create the request
   * @returns The created credential offer
   */
  private async createIndyCredentialRequest(
    offer: CredOffer,
    credentialDefinition: CredDef,
    holderDid: string
  ): Promise<{ credReq: CredReq; credReqMetadata: CredReqMetadata }> {
    const [credReq, credReqMetadata] = await this.indyHolderService.createCredentialRequest({
      holderDid: holderDid,
      credentialOffer: offer,
      credentialDefinition,
    })
    return { credReq, credReqMetadata }
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param requestOptions The object containing all the options for the credential request
   * @param credentialRecord the credential record containing the offer from which this request
   * is derived
   * @returns object containing associated attachment, formats and requestAttach elements
   *
   */
  public async createCredential(
    options: ServiceAcceptRequestOptions,
    record: CredentialExchangeRecord,
    requestAttachment: Attachment,
    offerAttachment?: Attachment
  ): Promise<FormatServiceCredentialAttachmentFormats> {
    // Assert credential attributes
    const credentialAttributes = record.credentialAttributes
    if (!credentialAttributes) {
      throw new CredentialProblemReportError(
        `Missing required credential attribute values on credential record with id ${record.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    const credOffer = offerAttachment?.getDataAsJson<CredOffer>()
    const credRequest = requestAttachment?.getDataAsJson<CredReq>()

    if (!credOffer || !credRequest) {
      throw new AriesFrameworkError('Missing CredOffer or CredReq in createCredential')
    }
    if (!this.indyIssuerService) {
      throw new AriesFrameworkError('Missing indyIssuerService in createCredential')
    }

    const [credential] = await this.indyIssuerService.createCredential({
      credentialOffer: credOffer,
      credentialRequest: credRequest,
      credentialValues: CredentialUtils.convertAttributesToValues(credentialAttributes),
    })

    const formats = new CredentialFormatSpec({
      attachId: this.generateId(),
      format: 'hlindy/cred-abstract@v2.0',
    })

    const attachmentId = options.attachId ? options.attachId : formats.attachId
    const issueAttachment = this.getFormatData(credential, attachmentId)
    return { format: formats, attachment: issueAttachment }
  }
  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in the Indy wallet
   * @param message the issue credential message
   */

  /**
   * Processes an incoming credential - retrieve metadata, retrieve payload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialRecord the credential exchange record for this credential
   */
  public async processCredential(
    options: ServiceAcceptCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    const credentialRequestMetadata = credentialRecord.metadata.get(CredentialMetadataKeys.IndyRequest)

    if (!credentialRequestMetadata) {
      throw new CredentialProblemReportError(
        `Missing required request metadata for credential with id ${credentialRecord.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }
    if (!options.credentialAttachment) {
      throw new AriesFrameworkError(`Missing credential for record id ${credentialRecord.id}`)
    }
    const indyCredential: Cred = options.credentialAttachment.getDataAsJson<Cred>()

    const credentialDefinition = await this.indyLedgerService.getCredentialDefinition(indyCredential.cred_def_id)

    if (!options.credentialAttachment) {
      throw new AriesFrameworkError('Missing credential attachment in processCredential')
    }
    const revocationRegistry = await this.getRevocationRegistry(options.credentialAttachment)
    const credentialId = await this.indyHolderService.storeCredential({
      credentialId: this.generateId(),
      credentialRequestMetadata,
      credential: indyCredential,
      credentialDefinition,
      revocationRegistryDefinition: revocationRegistry?.indy?.revocationRegistryDefinition,
    })
    credentialRecord.credentials.push({
      credentialRecordType: CredentialFormatType.Indy,
      credentialRecordId: credentialId,
    })
  }

  /**
   * Checks whether it should automatically respond to a proposal. Moved from CredentialResponseCoordinator
   * as this contains format-specific logic
   * @param credentialRecord The credential record for which we are testing whether or not to auto respond
   * @param agentConfig config object for the agent, used to hold auto accept state for the agent
   * @returns true if we should auto respond, false otherwise
   */

  public shouldAutoRespondToProposal(handlerOptions: HandlerAutoAcceptOptions): boolean {
    const autoAccept = composeAutoAccept(
      handlerOptions.credentialRecord.autoAcceptCredential,
      handlerOptions.autoAcceptType
    )

    if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return (
        this.areProposalValuesValid(handlerOptions.credentialRecord, handlerOptions.messageAttributes) &&
        this.areProposalAndOfferDefinitionIdEqual(handlerOptions.proposalAttachment, handlerOptions.offerAttachment)
      )
    }
    return false
  }

  /**
 * Checks whether it should automatically respond to a request. Moved from CredentialResponseCoordinator
 * as this contains format-specific logic
 * @param credentialRecord The credential record for which we are testing whether or not to auto respond
 * @param autoAcceptType auto accept type for this credential exchange - normal auto or content approved
 * @returns true if we should auto respond, false otherwise

 */

  public shouldAutoRespondToRequest(options: HandlerAutoAcceptOptions): boolean {
    const autoAccept = composeAutoAccept(options.credentialRecord.autoAcceptCredential, options.autoAcceptType)

    if (!options.requestAttachment) {
      throw new AriesFrameworkError(`Missing Request Attachment for Credential Record ${options.credentialRecord.id}`)
    }
    if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.isRequestDefinitionIdValid(
        options.requestAttachment,
        options.offerAttachment,
        options.proposalAttachment
      )
    }
    return false
  }
  /**
   * Checks whether it should automatically respond to a request. Moved from CredentialResponseCoordinator
   * as this contains format-specific logic
   * @param credentialRecord The credential record for which we are testing whether or not to auto respond
   * @param autoAcceptType auto accept type for this credential exchange - normal auto or content approved
   * @returns true if we should auto respond, false otherwise
   */

  public shouldAutoRespondToCredential(options: HandlerAutoAcceptOptions): boolean {
    const autoAccept = composeAutoAccept(options.credentialRecord.autoAcceptCredential, options.autoAcceptType)

    if (autoAccept === AutoAcceptCredential.ContentApproved) {
      if (options.credentialAttachment) {
        return this.areCredentialValuesValid(options.credentialRecord, options.credentialAttachment)
      }
    }
    return false
  }
  private areProposalValuesValid(
    credentialRecord: CredentialExchangeRecord,
    proposeMessageAttributes?: CredentialPreviewAttribute[]
  ) {
    const { credentialAttributes } = credentialRecord

    if (proposeMessageAttributes && credentialAttributes) {
      const proposeValues = CredentialUtils.convertAttributesToValues(proposeMessageAttributes)
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialAttributes)
      if (CredentialUtils.checkValuesMatch(proposeValues, defaultValues)) {
        return true
      }
    }
    return false
  }

  private areProposalAndOfferDefinitionIdEqual(proposalAttachment?: Attachment, offerAttachment?: Attachment) {
    const credOffer = offerAttachment?.getDataAsJson<CredOffer>()
    let credPropose = proposalAttachment?.getDataAsJson<CredPropose>()
    credPropose = JsonTransformer.fromJSON(credPropose, CredPropose)

    const proposalCredentialDefinitionId = credPropose?.credentialDefinitionId
    const offerCredentialDefinitionId = credOffer?.cred_def_id
    return proposalCredentialDefinitionId === offerCredentialDefinitionId
  }

  private areCredentialValuesValid(credentialRecord: CredentialExchangeRecord, credentialAttachment: Attachment) {
    const indyCredential = credentialAttachment.getDataAsJson<Cred>()

    if (!indyCredential) {
      new AriesFrameworkError(`Missing required base64 encoded attachment data for credential`)
      return false
    }

    const credentialMessageValues = indyCredential.values

    if (credentialRecord.credentialAttributes) {
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)

      if (CredentialUtils.checkValuesMatch(credentialMessageValues, defaultValues)) {
        return true
      }
    }
    return false
  }
  public async deleteCredentialById(credentialRecordId: string): Promise<void> {
    await this.indyHolderService.deleteCredential(credentialRecordId)
  }

  public async checkPreviewAttributesMatchSchemaAttributes(
    offerAttachment: Attachment,
    preview: V1CredentialPreview | V2CredentialPreview
  ): Promise<void> {
    const credOffer = offerAttachment?.getDataAsJson<CredOffer>()

    const schema = await this.indyLedgerService.getSchema(credOffer.schema_id)

    CredentialUtils.checkAttributesMatch(schema, preview)
  }

  private isRequestDefinitionIdValid(
    requestAttachment: Attachment,
    offerAttachment?: Attachment,
    proposeAttachment?: Attachment
  ) {
    const indyCredentialRequest = requestAttachment?.getDataAsJson<CredReq>()
    let indyCredentialProposal = proposeAttachment?.getDataAsJson<CredPropose>()
    indyCredentialProposal = JsonTransformer.fromJSON(indyCredentialProposal, CredPropose)

    const indyCredentialOffer = offerAttachment?.getDataAsJson<CredOffer>()

    if (indyCredentialProposal || indyCredentialOffer) {
      const previousCredentialDefinitionId =
        indyCredentialOffer?.cred_def_id ?? indyCredentialProposal?.credentialDefinitionId

      if (previousCredentialDefinitionId === indyCredentialRequest.cred_def_id) {
        return true
      }
      return false
    }
    return false
  }
  private generateId(): string {
    return uuid()
  }

  private async getRevocationRegistry(issueAttachment: Attachment): Promise<RevocationRegistry> {
    const credential: Cred = issueAttachment.getDataAsJson<Cred>()
    let indyRegistry
    if (credential.rev_reg_id) {
      indyRegistry = await this.indyLedgerService.getRevocationRegistryDefinition(credential.rev_reg_id)
    }
    return { indy: indyRegistry }
  }
}
