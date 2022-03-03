/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CredentialExchangeRecord, CredentialRepository } from '../..'
import type { EventEmitter } from '../../../../agent/EventEmitter'
import type { DidCommMessageRepository } from '../../../../storage'
import type { IndyHolderService, IndyIssuerService } from '../../../indy'
import type { IndyLedgerService } from '../../../ledger'
import type {
  AcceptCredentialOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../interfaces'
import type { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttributes'
import type {
  ServiceAcceptOfferOptions,
  ServiceAcceptRequestOptions,
  ServiceRequestCredentialOptions,
} from '../../protocol/v1'
import type { CredPropose } from '../../protocol/v1/models/CredentialFormatOptions'
import type {
  CredentialAttachmentFormats,
  CredentialFormatSpec,
  CredProposeOfferRequestFormat,
  OfferAttachmentFormats,
  ProposeAttachmentFormats,
} from '../models/CredentialFormatServiceOptions'
import type { Cred, CredOffer, CredReq, CredReqMetadata } from 'indy-sdk'

import { AutoAcceptCredential, CredentialMetadataKeys, CredentialUtils } from '../..'
import { AriesFrameworkError } from '../../../../../src/error'
import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../../utils/JsonEncoder'
import { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import { CredentialProblemReportError, CredentialProblemReportReason } from '../../errors'
import { V2CredentialPreview } from '../../protocol/v2/V2CredentialPreview'
import { CredentialFormatService } from '../CredentialFormatService'

export class IndyCredentialFormatService extends CredentialFormatService {
  private indyIssuerService: IndyIssuerService
  private indyLedgerService: IndyLedgerService
  private indyHolderService: IndyHolderService
  protected credentialRepository: CredentialRepository // protected as in base class
  private didCommMessageRepository: DidCommMessageRepository

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    didCommMessageRepository: DidCommMessageRepository,
    indyIssuerService: IndyIssuerService,
    indyLedgerService: IndyLedgerService,
    indyHolderService: IndyHolderService
  ) {
    super(credentialRepository, eventEmitter)
    this.credentialRepository = credentialRepository
    this.indyIssuerService = indyIssuerService
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
    this.didCommMessageRepository = didCommMessageRepository
  }

  /**
   * Not implemented; there for future versions
   */
  processRequest(options: RequestCredentialOptions, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }

  /**
   * Process offer - just sets the metadata for now
   * @param options object containing the offer attachment for use here to retreive the actual cred offer
   * @param credentialRecord the credential exchange record for this offer
   */
  public processOffer(options: AcceptProposalOptions, credentialRecord: CredentialExchangeRecord): void {
    if (options.offerAttachment) {
      const credOffer: CredOffer = options.offerAttachment.getDataAsJson<CredOffer>()

      credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
        schemaId: credOffer.schema_id,
        credentialDefinitionId: credOffer.cred_def_id,
      })
    }
  }
  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param options The object containing all the options for the proposed credential
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_PROPOSAL"
   * @returns object containing associated attachment, formats and filtersAttach elements
   *
   */
  public createProposal(options: ProposeCredentialOptions): ProposeAttachmentFormats {
    const formats: CredentialFormatSpec = {
      attachId: this.generateId(),
      format: 'hlindy/cred-filter@v2.0',
    }

    const attachment: Attachment = this.getFormatData(
      options.credentialFormats.indy?.payload.credentialPayload,
      formats.attachId
    )
    const { previewWithAttachments } = this.getCredentialLinkedAttachments(options)

    return { format: formats, attachment, preview: previewWithAttachments }
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the credential offer
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_OFFER"
   * @returns object containing associated attachment, formats and offersAttach elements
   *
   */
  public async createOffer(proposal: ServiceAcceptOfferOptions): Promise<OfferAttachmentFormats> {
    const formats: CredentialFormatSpec = {
      attachId: this.generateId(),
      format: 'hlindy/cred-abstract@v2.0',
    }
    const offer = await this.createCredentialOffer(proposal)

    let preview: V2CredentialPreview | undefined

    if (proposal?.credentialFormats.indy?.attributes) {
      preview = new V2CredentialPreview({
        attributes: proposal?.credentialFormats.indy?.attributes,
      })
    }
    // if the proposal has an attachment Id use that, otherwise the generated id of the formats object
    const attachmentId = proposal.attachId ? proposal.attachId : formats.attachId

    const offersAttach: Attachment = this.getFormatData(offer, attachmentId)

    return { format: formats, attachment: offersAttach, preview }
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
  ): Promise<CredentialAttachmentFormats> {
    if (options.offerAttachment) {
      const offer = options.offerAttachment.getDataAsJson<CredOffer>()

      // format service -> get the credential definition and create the [indy] credential request
      options.credentialDefinition = await this.getCredentialDefinition(offer)

      const { credReq, credReqMetadata } = await this.createIndyCredentialRequest(options, offer)
      credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, credReqMetadata)

      const formats: CredentialFormatSpec = {
        attachId: this.generateId(),
        format: 'hlindy/cred-req@v2.0',
      }

      const attachmentId = options.attachId ? options.attachId : formats.attachId
      const requestAttach: Attachment = this.getFormatData(credReq, attachmentId)
      return { format: formats, attachment: requestAttach }
    } else {
      throw Error(`Missing attachment from offer messagte, credential record id = ${credentialRecord.id}`)
    }
  }

  /**
   * Extract the payload from the message attachment data and turn that into a V2CredRequestFormat object. For
   * Indy this will be a CredOffer or CredReq object embedded threrein.n
   * @param data the {@link Attachment} object which contains the message payload
   * @return V2CredRequestFormat object containing the Indy SDK CredReq, note meta data does not
   * seem to be needed here (or even present in the payload)
   */
  public getCredentialPayload<T>(data: Attachment): CredProposeOfferRequestFormat {
    const credentialOfferJson: T = data.getDataAsJson<T>() as T
    return {
      indy: {
        payload: {
          credentialPayload: credentialOfferJson,
        },
      },
    }
  }

  private async getCredentialDefinition(credOffer: CredOffer) {
    const indyCredDef = await this.indyLedgerService.getCredentialDefinition(credOffer.cred_def_id)
    return {
      indy: {
        credDef: indyCredDef,
      },
    }
  }

  /**
   * Get linked attachments for indy format from a proposal message. This allows attachments
   * to be copied across to old style credential records
   *
   * @param proposal ProposeCredentialOptions object containing (optionally) the linked attachments
   * @return array of linked attachments or undefined if none present
   */
  private getCredentialLinkedAttachments(proposal: ProposeCredentialOptions): {
    attachments: Attachment[] | undefined
    previewWithAttachments: V2CredentialPreview
  } {
    // Add the linked attachments to the credentialProposal
    const credPropose: CredPropose = proposal.credentialFormats.indy?.payload.credentialPayload as CredPropose

    let attachments: Attachment[] | undefined
    let previewWithAttachments: V2CredentialPreview = new V2CredentialPreview({
      attributes: credPropose.attributes ? credPropose.attributes : [],
    })
    if (proposal.credentialFormats.indy && credPropose.linkedAttachments) {
      // there are linked attachments so transform into the attribute field of the CredentialPreview object for
      // this proposal
      if (credPropose.attributes && credPropose.credentialDefinitionId) {
        previewWithAttachments = CredentialUtils.createAndLinkAttachmentsToPreview(
          credPropose.linkedAttachments,
          new V2CredentialPreview({
            attributes: credPropose.attributes,
          })
        )
      }
      attachments = credPropose.linkedAttachments.map((linkedAttachment) => linkedAttachment.attachment)

      credPropose.credentialDefinitionId = this.getCredentialDefinitionId(proposal)

      proposal.credentialFormats.indy.payload.credentialPayload = credPropose
    }
    return { attachments, previewWithAttachments }
  }

  /**
   *
   * @param options Gets the credential definition id if present for an indy credential
   * @returns the credential definition id for this credential
   */
  private getCredentialDefinitionId(options: ProposeCredentialOptions): string | undefined {
    const credPropose: CredPropose = options.credentialFormats.indy?.payload.credentialPayload as CredPropose
    return credPropose.credentialDefinitionId
  }
  /**
   * Get attributes for indy format from a proposal message. This allows attributes
   * to be copied across to old style credential records
   *
   * @param proposal ProposeCredentialOptions object containing (optionally) the attributes
   * @return array of attributes or undefined if none present
   */
  public getCredentialAttributes(proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined {
    const credPropose: CredPropose = proposal.credentialFormats.indy?.payload as CredPropose
    return credPropose.attributes
  }

  /**
   *
   * Returns an object of type {@link Attachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   * @returns attachment to the credential proposal
   */
  public getFormatData(data: unknown, id: string): Attachment {
    const attachment: Attachment = new Attachment({
      id,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(data),
      }),
    })
    return attachment
  }

  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param credentialDefinitionId The credential definition to create an offer for
   * @returns The created credential offer
   */
  private async createCredentialOffer(
    proposal: ServiceAcceptOfferOptions | NegotiateProposalOptions | OfferCredentialOptions
  ): Promise<CredOffer> {
    if (this.indyIssuerService && proposal.credentialFormats?.indy?.credentialDefinitionId) {
      const credOffer: CredOffer = await this.indyIssuerService.createCredentialOffer(
        proposal.credentialFormats.indy.credentialDefinitionId
      )
      return credOffer
    }
    if (!this.indyIssuerService) {
      throw new AriesFrameworkError('Missing Indy Issuer Service')
    } else {
      throw new AriesFrameworkError('Missing Credential Definition id')
    }
  }

  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param options RequestCredentialOptions the config options for the credential request
   * @throws Error if unable to create the request
   * @returns The created credential offer
   */
  private async createIndyCredentialRequest(
    options: RequestCredentialOptions,
    offer: CredOffer
  ): Promise<{ credReq: CredReq; credReqMetadata: CredReqMetadata }> {
    if (
      this.indyHolderService &&
      options.holderDid &&
      options.credentialDefinition &&
      options.credentialDefinition.indy?.credDef
    ) {
      const [credReq, credReqMetadata] = await this.indyHolderService.createCredentialRequest({
        holderDid: options.holderDid,
        credentialOffer: offer,
        credentialDefinition: options.credentialDefinition.indy?.credDef,
      })
      return { credReq, credReqMetadata }
    }
    throw Error('Unable to create Credential Request')
  }

  /**
   * Method to insert a preview object into a proposal. This can occur when we retrieve a
   * preview object as part of the stored credential record and need to add it to the
   * proposal object used for processing credential proposals
   * @param proposal the proposal object needed for acceptance processing
   * @param preview the preview containing stored attributes
   * @returns proposal object with extra preview attached
   */
  public setPreview(proposal: AcceptProposalOptions, preview: V2CredentialPreview): AcceptProposalOptions {
    if (proposal.credentialFormats.indy) {
      proposal.credentialFormats.indy.attributes = preview.attributes
    }
    return proposal
  }

  public async processProposal(
    options: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<AcceptProposalOptions> {
    let credPropose: CredPropose | undefined
    if (options.proposal) {
      credPropose = options.proposal.getDataAsJson<CredPropose>()
      if (credPropose) {
        credentialRecord.metadata.set(CredentialMetadataKeys.IndyCredential, {
          schemaId: credPropose.schemaId,
          credentialDefinitionId: credPropose.credentialDefinitionId,
        })
      } else {
        throw new AriesFrameworkError(`Missing data payload in attachment in credential Record ${credentialRecord.id}`)
      }

      options.credentialFormats = {
        indy: {
          attributes: credentialRecord.credentialAttributes,
          credentialDefinitionId: credPropose?.credentialDefinitionId,
        },
      }
      return options
    }

    throw new AriesFrameworkError('Unable to create accept proposal options object')
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
    record: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    // Assert credential attributes
    const credentialAttributes = record.credentialAttributes
    if (!credentialAttributes) {
      throw new CredentialProblemReportError(
        `Missing required credential attribute values on credential record with id ${record.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }

    let credOffer: CredOffer | undefined
    let credRequest: CredReq | undefined
    if (options.offerAttachment) {
      credOffer = options.offerAttachment.getDataAsJson<CredOffer>()
    }
    if (options.requestAttachment) {
      credRequest = options.requestAttachment.getDataAsJson<CredReq>()
    }

    if (credOffer && credRequest) {
      if (this.indyIssuerService) {
        const [credential] = await this.indyIssuerService.createCredential({
          credentialOffer: credOffer,
          credentialRequest: credRequest,
          credentialValues: CredentialUtils.convertAttributesToValues(credentialAttributes),
        })

        const formats: CredentialFormatSpec = {
          attachId: this.generateId(),
          format: 'hlindy/cred-abstract@v2.0',
        }

        const attachmentId = options.attachId ? options.attachId : formats.attachId
        const issueAttachment: Attachment = this.getFormatData(credential, attachmentId)
        return { format: formats, attachment: issueAttachment }
      }
    }
    throw Error('Missing CredOffer or CredReq for createIssueCredentialAttachFormats')
  }
  /**
   * Processes an incoming credential - retreive metadata, retrievepayload and store it in the Indy wallet
   * @param message the issue credential message
   */

  /**
   * Processes an incoming credential - retreive metadata, retrievepayload and store it in the Indy wallet
   * @param options the issue credential message wrapped inside this object
   * @param credentialRecord the credential exchange record for this credential
   */
  public async processCredential(
    options: AcceptCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    const credentialRequestMetadata = credentialRecord.metadata.get(CredentialMetadataKeys.IndyRequest)

    if (!credentialRequestMetadata) {
      throw new CredentialProblemReportError(
        `Missing required request metadata for credential with id ${credentialRecord.id}`,
        { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
      )
    }
    if (options.credential) {
      const indyCredential: Cred = options.credential.getDataAsJson<Cred>()

      const credentialDefinition = await this.indyLedgerService.getCredentialDefinition(indyCredential.cred_def_id)

      if (!this.indyHolderService) {
        throw new CredentialProblemReportError(
          `Missing required indy holder service for credential with record id ${credentialRecord.id}`,
          { problemCode: CredentialProblemReportReason.IssuanceAbandoned }
        )
      }
      const credentialId = await this.indyHolderService.storeCredential({
        credentialId: this.generateId(),
        credentialRequestMetadata,
        credential: indyCredential,
        credentialDefinition,
      })
      credentialRecord.credentialId = credentialId
    } else {
      throw new AriesFrameworkError(`Missing credential for record id ${credentialRecord.id}`)
    }
  }
  /**
 * Checks whether it should automatically respond to a proposal. Moved from CredentialResponseCoordinator
 * as this contains format-specific logic
 * @param credentialRecord The credential record for which we are testing whether or not to auto respond
 * @param agentConfig config object for the agent, used to hold auto accept state for the agent
 * @returns true if we should auto respond, false otherwise

 */
  public shouldAutoRespondToProposal(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    proposeMessageAttributes?: CredentialPreviewAttribute[],
    proposePayload?: CredProposeOfferRequestFormat,
    offerPayload?: CredProposeOfferRequestFormat
  ): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      autoAcceptType
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return (
        this.areProposalValuesValid(credentialRecord, proposeMessageAttributes) &&
        this.areProposalAndOfferDefinitionIdEqual(proposePayload, offerPayload)
      )
    }
    return false
  }

  /**
   * Checks whether it should automatically respond to an offer. Moved from CredentialResponseCoordinator
   * as this contains format-specific logic
   * @param credentialRecord The credential record for which we are testing whether or not to auto respond
   * @param autoAcceptType auto accept type for this credential exchange - normal auto or content approved
   * @returns true if we should auto respond, false otherwise

   */
  public shouldAutoRespondToOffer(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    offerPayload?: CredProposeOfferRequestFormat,
    offerMessageAttributes?: CredentialPreviewAttribute[],
    proposePayload?: CredProposeOfferRequestFormat
  ): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      autoAcceptType
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return (
        this.areOfferValuesValid(credentialRecord, offerMessageAttributes) &&
        this.areProposalAndOfferDefinitionIdEqual(proposePayload, offerPayload)
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
  public shouldAutoRespondToRequest(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    requestPayload?: CredProposeOfferRequestFormat,
    offerPayload?: CredProposeOfferRequestFormat,
    proposePayload?: CredProposeOfferRequestFormat
  ): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      autoAcceptType
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.isRequestDefinitionIdValid(requestPayload, offerPayload, proposePayload)
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
  public shouldAutoRespondToCredential(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    credentialPayload?: CredProposeOfferRequestFormat
  ): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      credentialRecord.autoAcceptCredential,
      autoAcceptType
    )

    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    } else if (autoAccept === AutoAcceptCredential.ContentApproved) {
      return this.areCredentialValuesValid(credentialRecord, credentialPayload)
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

  private areProposalAndOfferDefinitionIdEqual(
    proposePayload?: CredProposeOfferRequestFormat,
    offerPayload?: CredProposeOfferRequestFormat
  ) {
    const credPropose = proposePayload?.indy?.payload.credentialPayload as CredPropose | undefined
    const credOffer = offerPayload?.indy?.payload.credentialPayload as CredOffer | undefined

    const proposalCredentialDefinitionId = credPropose?.credentialDefinitionId
    const offerCredentialDefinitionId = credOffer?.cred_def_id

    return proposalCredentialDefinitionId === offerCredentialDefinitionId
  }

  private areOfferValuesValid(
    credentialRecord: CredentialExchangeRecord,
    offerMessageAttributes?: CredentialPreviewAttribute[]
  ) {
    const { credentialAttributes } = credentialRecord

    if (offerMessageAttributes && credentialAttributes) {
      const offerValues = CredentialUtils.convertAttributesToValues(offerMessageAttributes)
      const defaultValues = CredentialUtils.convertAttributesToValues(credentialAttributes)
      if (CredentialUtils.checkValuesMatch(offerValues, defaultValues)) {
        return true
      }
    }
    return false
  }

  private areCredentialValuesValid(
    credentialRecord: CredentialExchangeRecord,
    credentialPayload?: CredProposeOfferRequestFormat
  ) {
    if (credentialRecord.credentialAttributes && credentialPayload) {
      const indyCredential: Cred = credentialPayload.indy?.payload.credentialPayload as Cred

      if (!indyCredential) {
        throw Error(`Missing required base64 encoded attachment data for credential`)
        return false
      }

      const credentialMessageValues = indyCredential.values

      const defaultValues = CredentialUtils.convertAttributesToValues(credentialRecord.credentialAttributes)

      if (CredentialUtils.checkValuesMatch(credentialMessageValues, defaultValues)) {
        return true
      }
    }
    return false
  }
  private isRequestDefinitionIdValid(
    requestPayload?: CredProposeOfferRequestFormat,
    offerPayload?: CredProposeOfferRequestFormat,
    proposePayload?: CredProposeOfferRequestFormat
  ) {
    const indyCredentialRequest: CredReq = requestPayload?.indy?.payload.credentialPayload as CredReq
    const indyCredentialProposal: CredPropose | undefined = proposePayload?.indy?.payload
      .credentialPayload as CredPropose
    const indyCredentialOffer: CredOffer | undefined = offerPayload?.indy?.payload.credentialPayload as CredOffer

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
}
