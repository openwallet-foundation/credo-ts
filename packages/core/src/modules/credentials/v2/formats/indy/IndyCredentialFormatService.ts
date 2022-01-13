import type { CredentialRecord, CredentialRepository } from '../../..'
import type { EventEmitter } from '../../../../../agent/EventEmitter'
import type { IndyHolderService, IndyIssuerService } from '../../../../indy'
import type { IndyLedgerService } from '../../../../ledger'
import type { CredentialPreviewAttribute } from '../../../CredentialPreviewAttributes'
import type {
  AcceptProposalOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
  V2CredDefinitionFormat,
  V2CredOfferFormat,
  V2CredProposalFormat,
  V2CredRequestFormat,
} from '../../interfaces'
import type { V2OfferCredentialMessage } from '../../messages/V2OfferCredentialMessage'
import type { V2RequestCredentialMessage } from '../../messages/V2RequestCredentialMessage'
import type { V2AttachmentFormats } from '../CredentialFormatService'
import type { V2CredentialFormatSpec } from '../V2CredentialFormat'
import type { CredDef, CredOffer, CredReq } from 'indy-sdk'

import { CredentialMetadataKeys, CredentialUtils } from '../../..'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { V2CredentialPreview } from '../../V2CredentialPreview'
import { CredentialFormatService } from '../CredentialFormatService'
import { INDY_ATTACH_ID, ATTACHMENT_FORMAT } from '../V2CredentialFormat'

const INDY_CREDENTIAL_OFFER_ATTACHMENT_ID = 'indy'

export class IndyCredentialFormatService extends CredentialFormatService {
  private indyIssuerService?: IndyIssuerService
  private indyLedgerService?: IndyLedgerService
  private indyHolderService?: IndyHolderService
  protected credentialRepository: CredentialRepository // protected as in base class

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    indyIssuerService?: IndyIssuerService,
    indyLedgerService?: IndyLedgerService,
    indyHolderService?: IndyHolderService
  ) {
    super(credentialRepository, eventEmitter)
    this.credentialRepository = credentialRepository
    this.indyIssuerService = indyIssuerService
    this.indyLedgerService = indyLedgerService
    this.indyHolderService = indyHolderService
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the proposed credential
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_PROPOSAL"
   * @returns object containing associated attachment, formats and filtersAttach elements
   *
   */
  public getCredentialProposeAttachFormats(
    proposal: ProposeCredentialOptions,
    messageType: string
  ): V2AttachmentFormats {
    const formats: V2CredentialFormatSpec = this.getFormatIdentifier(messageType)
    const filtersAttach: Attachment[] = this.getFormatData(proposal.credentialFormats)

    return { formats, filtersAttach }
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the credential offer
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_OFFER"
   * @returns object containing associated attachment, formats and offersAttach elements
   *
   */
  public getCredentialOfferAttachFormats(
    proposal: AcceptProposalOptions,
    offer: V2CredOfferFormat,
    messageType: string
  ): V2AttachmentFormats {
    let preview: V2CredentialPreview | undefined

    if (proposal?.credentialFormats.indy?.attributes) {
      preview = new V2CredentialPreview({ attributes: proposal?.credentialFormats.indy?.attributes })
    }
    const formats: V2CredentialFormatSpec = this.getFormatIdentifier(messageType)
    const offersAttach: Attachment[] = this.getFormatData(offer.indy?.credentialOffer)

    return { preview, formats, offersAttach }
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the credential offer
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_OFFER"
   * @returns object containing associated attachment, formats and requestAttach elements
   *
   */
  public getCredentialRequestAttachFormats(request: V2CredRequestFormat, messageType: string): V2AttachmentFormats {
    const formats: V2CredentialFormatSpec = this.getFormatIdentifier(messageType)
    const requestAttach: Attachment[] = this.getFormatDataForRequest(request)
    return { formats, requestAttach }
  }
  /**
   * Save the meta data and emit event for a credential proposal
   * @param proposal wrapper object that contains either indy or some other format of proposal, in this case indy.
   * see {@link V2CredProposalFormat}
   * @param credentialRecord the record containing attributes for this credentual
   */
  public async setMetaDataAndEmitEventForProposal(
    proposal: V2CredProposalFormat,
    credentialRecord: CredentialRecord
  ): Promise<void> {
    credentialRecord.metadata.set('_internal/indyCredential', {
      schemaId: proposal.indy?.schemaId,
      credentialDefinintionId: proposal.indy?.credentialDefinitionId,
    })
    await this.credentialRepository.save(credentialRecord)
    return await super.emitEvent(credentialRecord)
  }

  /**
   * Set the meta data only
   * @param offer the object containing information about the offer, including the indy sdk specific stuff
   * @param credentialRecord the credential record containing the credential data and surrounding v2 attachments
   * @returns void
   */
  public setMetaDataForOffer(offer: V2CredOfferFormat, credentialRecord: CredentialRecord): void {
    credentialRecord.metadata.set('_internal/indyCredential', {
      schemaId: offer.indy?.credentialOffer.schema_id,
      credentialDefinintionId: offer.indy?.credentialOffer.cred_def_id,
    })
  }

  /**
   * Set the meta data only for a credential request
   * @param request the object containing information about the request, including the indy sdk specific stuff
   * @param credentialRecord the credential record containing the credential data and surrounding v2 attachments
   * @returns void
   */
  public setMetaDataForRequest(request: V2CredRequestFormat, credentialRecord: CredentialRecord): void {
    if (request.indy?.requestMetaData) {
      credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, request.indy?.requestMetaData)
    }
  }

  /**
   * Get attachment format identifier for format and message combination
   *
   * @param messageType Message type for which to return the format identifier
   * @return V2CredentialFormatSpec - Issue credential attachment format identifier
   */
  public getFormatIdentifier(messageType: string): V2CredentialFormatSpec {
    return ATTACHMENT_FORMAT[messageType].indy
  }

  /**
   *
   * @param options Gets the credential definition id if present for an indy credential
   * @returns the credential definition id for this credential
   */
  public getCredentialDefinitionId(options: ProposeCredentialOptions): string | undefined {
    return options.credentialFormats.indy?.credentialDefinitionId
  }

  /** Get the credential offer associated with a particular credential record. The actual offer data
   * is the base64 encoded payload in the offer attachment. Using index 0 here: is this correct?
   * (MJR-TODO replace with find on the id of the attachment but what should this id be?)
   * @param record the credential record
   * @return the cred offer wrapped in new V2 format
   */
  public getCredentialOffer(record: CredentialRecord): V2CredOfferFormat | undefined {
    const data = record.offerMessage?.offerAttachments[0].data

    if (data) {
      const credentialOfferJson: CredOffer = data.getDataAsJson<CredOffer>() ?? null

      return {
        indy: {
          credentialOffer: credentialOfferJson,
        },
      }
    }
  }

  /**
   * Retrieve the credential definition from the ledger, currently Indy SDK but
   * will have other possibilities in the future
   * @param offer the offer object containing the id of the credential definition on on the ledger
   * @return CredentialDefinition in v2 format (currently only Indy {@link CredDef})
   */
  public async getCredentialDefinition(offer: V2CredOfferFormat): Promise<V2CredDefinitionFormat | undefined> {
    let indyCredDef: CredDef
    if (this.indyLedgerService && offer.indy?.credentialOffer) {
      indyCredDef = await this.indyLedgerService.getCredentialDefinition(offer.indy?.credentialOffer.cred_def_id)
      return {
        indy: {
          credentialDefinition: indyCredDef,
        },
      }
    }
  }

  /**
   * Get linked attachments for indy format from a proposal message. This allows attachments
   * to be copied across to old style credential records
   *
   * @param proposal ProposeCredentialOptions object containing (optionally) the linked attachments
   * @return array of linked attachments or undefined if none present
   */
  public getCredentialLinkedAttachments(proposal: ProposeCredentialOptions): {
    attachments: Attachment[] | undefined
    previewWithAttachments: V2CredentialPreview
  } {
    // Add the linked attachments to the credentialProposal

    let attachments: Attachment[] | undefined
    let previewWithAttachments: V2CredentialPreview = new V2CredentialPreview({ attributes: [] })
    if (proposal.credentialFormats.indy && proposal.credentialFormats.indy?.linkedAttachments) {
      // there are linked attachments so transform into the attribute field of the CredentialPreview object for
      // this proposal
      if (proposal.credentialFormats.indy?.attributes) {
        previewWithAttachments = CredentialUtils.createAndLinkAttachmentsToPreview(
          proposal.credentialFormats.indy.linkedAttachments,
          new V2CredentialPreview({ attributes: proposal.credentialFormats.indy?.attributes })
        )
      }
      attachments = proposal.credentialFormats.indy.linkedAttachments.map(
        (linkedAttachment) => linkedAttachment.attachment
      )
    }
    return { attachments, previewWithAttachments }
  }

  /**
   * Get attributes for indy format from a proposal message. This allows attributes
   * to be copied across to old style credential records
   *
   * @param proposal ProposeCredentialOptions object containing (optionally) the attributes
   * @return array of attributes or undefined if none present
   */
  public getCredentialAttributes(proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined {
    return proposal.credentialFormats.indy?.attributes
  }

  /**
   *
   * Returns an object of type {@link Attachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @returns attachment to the credential proposal
   */
  public getFormatData(data: unknown): Attachment[] {
    const offersAttach: Attachment[] = []

    offersAttach.push(
      new Attachment({
        id: INDY_ATTACH_ID,
        mimeType: 'application/json',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(data),
        }),
      })
    )

    return offersAttach
  }

  /**
   * Returns an object of type {@link Attachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object - in this case within the request field
   * @returns attachment to the credential request
   */
  public getFormatDataForRequest(data: V2CredRequestFormat): Attachment[] {
    const requestAttach: Attachment[] = []

    requestAttach.push(
      new Attachment({
        id: INDY_ATTACH_ID,
        mimeType: 'application/json',
        data: new AttachmentData({
          base64: JsonEncoder.toBase64(data.indy?.request),
        }),
      })
    )

    return requestAttach
  }
  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param credentialDefinitionId The credential definition to create an offer for
   * @returns The created credential offer
   */
  public async createCredentialOffer(proposal: AcceptProposalOptions): Promise<V2CredOfferFormat> {
    if (this.indyIssuerService && proposal.credentialFormats?.indy?.credentialDefinitionId) {
      const credOffer: CredOffer = await this.indyIssuerService.createCredentialOffer(
        proposal.credentialFormats.indy.credentialDefinitionId
      )

      return {
        indy: {
          credentialOffer: credOffer, // old v1 object from Indy SDK
        },
      }
    }

    if (!this.indyIssuerService) {
      throw new Error('Missing Indy Issuer Service')
    } else {
      throw new Error('Missing Credential Definition id')
    }
  }

  /**
   * Create a credential offer for the given credential definition id.
   *
   * @param credentialDefinitionId The credential definition to create an offer for
   * @throws Error if unable to create the request
   * @returns The created credential offer
   */
  public async createCredentialRequest(options: RequestCredentialOptions): Promise<V2CredRequestFormat> {
    if (
      this.indyHolderService &&
      options.holderDid &&
      options.offer &&
      options.offer.indy?.credentialOffer &&
      options.credentialDefinition &&
      options.credentialDefinition.indy?.credentialDefinition
    ) {
      const [credReq, credReqMetadata] = await this.indyHolderService.createCredentialRequest({
        holderDid: options.holderDid,
        credentialOffer: options.offer.indy?.credentialOffer,
        credentialDefinition: options.credentialDefinition.indy?.credentialDefinition,
      })
      const request: V2CredRequestFormat = {
        indy: {
          request: credReq,
          requestMetaData: credReqMetadata,
        },
      }
      return request
    }
    throw Error('Unable to create Credential Request')
  }

  /**
   * Extracts the data from the base64 encoded attachment payload of a credential offer and maps
   * it to a {@link V2CredOfferFormat} object
   * @param credentialOfferMessage the incoming credential offer message
   * @returns the credntial offer with an indy specific {@CredOffer} - this is from the Indy SDK
   */
  public getCredentialOfferMessage(credentialOfferMessage: V2OfferCredentialMessage): V2CredOfferFormat {
    const attachment = credentialOfferMessage.offerAttachments.find(
      (attachment) => attachment.id === INDY_CREDENTIAL_OFFER_ATTACHMENT_ID
    )

    // Extract credential offer from attachment
    const credentialOfferJson = attachment?.data?.getDataAsJson<CredOffer>() ?? null

    if (credentialOfferJson) {
      return {
        indy: {
          credentialOffer: credentialOfferJson,
        },
      }
    }
    throw Error('No json object found for the credential offer')
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

  /**
   * Extract the payload from the message and turn that into a V2CredRequestFormat object. For
   * Indy this will be a CredReq object embedded threrein.n
   * @param message the {@link V2RequestCredentialMessage}
   * @return V2CredRequestFormat object containing the Indy SDK CredReq, note meta data does not
   * seem to be needed here (or even present in the payload)
   */
  public getCredentialRequest(message: V2RequestCredentialMessage): V2CredRequestFormat | undefined {
    const data = message.requestsAttach[0].data

    if (data) {
      const credentialRequestJson: CredReq = data.getDataAsJson<CredReq>() ?? null

      return {
        indy: {
          request: credentialRequestJson,
        },
      }
    }
  }
}
