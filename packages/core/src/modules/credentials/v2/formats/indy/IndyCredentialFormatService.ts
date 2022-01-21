import type { CredentialRecord, CredentialRepository, CredentialStateChangedEvent, OfferMessageType } from '../../..'
import type { EventEmitter } from '../../../../../agent/EventEmitter'
import type { IndyHolderService, IndyIssuerService } from '../../../../indy'
import type { IndyLedgerService } from '../../../../ledger'
import type { CredentialPreviewAttribute } from '../../../CredentialPreviewAttributes'
import type {
  AcceptProposalOptions,
  CredPropose,
  NegotiateProposalOptions,
  OfferCredentialOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
  V2CredDefinitionFormat,
} from '../../../interfaces'
import type { V2OfferCredentialMessage } from '../../messages/V2OfferCredentialMessage'
import type { V2ProposeCredentialMessage } from '../../messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessage } from '../../messages/V2RequestCredentialMessage'
import type {
  V2AttachmentFormats,
  V2CredProposeOfferRequestFormat,
  V2CredProposalFormat,
} from '../CredentialFormatService'
import type { MetaDataService } from '../MetaDataService'
import type { V2CredentialFormatSpec } from '../V2CredentialFormat'
import type { CredDef, CredOffer, CredReq } from 'indy-sdk'

import { CredentialEventTypes, CredentialUtils } from '../../..'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { V2CredentialPreview } from '../../V2CredentialPreview'
import { CredentialFormatService } from '../CredentialFormatService'
import { ATTACHMENT_FORMAT } from '../V2CredentialFormat'

import { IndyMetaDataService } from './IndyMetaDataService'

export class IndyCredentialFormatService extends CredentialFormatService {
  private indyIssuerService?: IndyIssuerService
  private indyLedgerService?: IndyLedgerService
  private indyHolderService?: IndyHolderService
  protected credentialRepository: CredentialRepository // protected as in base class
  private metaDataService: MetaDataService

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
    this.metaDataService = new IndyMetaDataService(credentialRepository, eventEmitter)
  }

  public getMetaDataService(): MetaDataService {
    return this.metaDataService
  }
  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the proposed credential
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_PROPOSAL"
   * @returns object containing associated attachment, formats and filtersAttach elements
   *
   */
  public createProposalAttachFormats(proposal: ProposeCredentialOptions, messageType: string): V2AttachmentFormats {
    // loop through all formats present in this proposal: we can get this from the
    // object keys in the credential format within the proposal

    const formats: V2CredentialFormatSpec = this.getFormatIdentifier(messageType)
    const attachId = this.generateId()
    const filtersAttach: Attachment = this.getFormatData(proposal.credentialFormats.indy, attachId)
    const { previewWithAttachments } = this.getCredentialLinkedAttachments(proposal)
    return { formats, filtersAttach, previewWithAttachments }
  }

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the credential offer
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_OFFER"
   * @returns object containing associated attachment, formats and offersAttach elements
   *
   */
  public createOfferAttachFormats(
    proposal: AcceptProposalOptions,
    offer: V2CredProposeOfferRequestFormat,
    messageType: string
  ): V2AttachmentFormats {
    let preview: V2CredentialPreview | undefined

    if (proposal?.credentialFormats.indy?.attributes) {
      preview = new V2CredentialPreview({ attributes: proposal?.credentialFormats.indy?.attributes })
    }
    const formats: V2CredentialFormatSpec = this.getFormatIdentifier(messageType)

    const offersAttach: Attachment = this.getFormatData(offer.indy?.payload.credentialPayload, formats.attachId)

    return { preview, formats, offersAttach }
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
  public async getCredentialRequestAttachFormats(
    requestOptions: RequestCredentialOptions,
    credentialRecord: CredentialRecord
  ): Promise<V2AttachmentFormats> {
    const message: OfferMessageType = credentialRecord.offerMessage as V2OfferCredentialMessage

    // use the attach id in the formats object to find the correct attachment
    if (message) {
      const indyFormat = message.formats.find((f) => f.format.includes('indy'))
      if (indyFormat) {
        const attachment = message.offerAttachments.find((attachment) => attachment.id === indyFormat?.attachId)
        if (attachment) {
          const data = attachment.data
          if (data) {
            requestOptions.offer = this.getCredentialPayload<CredReq>(data)
          } else {
            throw Error(`Missing data payload in attachment in credential Record ${credentialRecord.id}`)
          }
        }
      }
    } else {
      throw Error(`Missing message in credential Record ${credentialRecord.id}`)
    }

    // For W3C we will need to be able to create a request when there is no offer
    // whereas for Indy there must be an offer according to the v2 protocol

    if (requestOptions.offer) {
      // format service -> get the credential definition and create the [indy] credential request
      const offer = requestOptions.offer as V2CredProposeOfferRequestFormat
      requestOptions.credentialDefinition = await this.getCredentialDefinition(offer)
      const credOfferRequest: V2CredProposeOfferRequestFormat = await this.createRequest(requestOptions)

      const formats: V2CredentialFormatSpec = this.getFormatIdentifier('CRED_20_REQUEST')
      const requestAttach: Attachment = this.getFormatData(
        credOfferRequest.indy?.payload.credentialPayload,
        formats.attachId
      )
      return { formats, requestAttach, credOfferRequest }
    } else {
      throw Error('Indy cannot begin credential exchange without offer')
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
   * Extract the payload from the message and turn that into a V2CredRequestFormat object. For
   * Indy this will be a CredOffer or CredReq object embedded threrein.n
   * @param message the {@link V2RequestCredentialMessage}
   * @return V2CredRequestFormat object containing the Indy SDK CredReq, note meta data does not
   * seem to be needed here (or even present in the payload)
   */
  public getCredentialPayload<T extends CredOffer | CredReq | CredPropose>(
    data: AttachmentData
  ): V2CredProposeOfferRequestFormat {
    const credentialOfferJson: T = data.getDataAsJson<T>() ?? null
    return {
      indy: {
        payload: {
          credentialPayload: credentialOfferJson,
        },
      },
    }
  }

  /**
   * Retrieve the credential definition from the ledger, currently Indy SDK but
   * will have other possibilities in the future
   * @param offer the offer object containing the id of the credential definition on on the ledger
   * @return CredentialDefinition in v2 format (currently only Indy {@link CredDef})
   */
  public async getCredentialDefinition(
    offer: V2CredProposeOfferRequestFormat
  ): Promise<V2CredDefinitionFormat | undefined> {
    let indyCredDef: CredDef

    if (this.indyLedgerService && offer.indy?.payload.credentialPayload) {
      if (offer.indy.payload.credentialPayload?.cred_def_id) {
        indyCredDef = await this.indyLedgerService.getCredentialDefinition(
          offer.indy.payload.credentialPayload?.cred_def_id
        )
        return {
          indy: {
            credentialDefinition: indyCredDef,
          },
        }
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
  private getCredentialLinkedAttachments(proposal: ProposeCredentialOptions): {
    attachments: Attachment[] | undefined
    previewWithAttachments: V2CredentialPreview
  } {
    // Add the linked attachments to the credentialProposal
    const credPropose: CredPropose = proposal.credentialFormats.indy?.payload as CredPropose
    let attachments: Attachment[] | undefined
    let previewWithAttachments: V2CredentialPreview = new V2CredentialPreview({ attributes: [] })
    if (proposal.credentialFormats.indy && credPropose.linkedAttachments) {
      // there are linked attachments so transform into the attribute field of the CredentialPreview object for
      // this proposal
      if (credPropose.attributes) {
        previewWithAttachments = CredentialUtils.createAndLinkAttachmentsToPreview(
          credPropose.linkedAttachments,
          new V2CredentialPreview({ attributes: credPropose.attributes })
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
    const credPropose: CredPropose = options.credentialFormats.indy?.payload as CredPropose
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
      id: id,
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
  public async createOffer(
    proposal: AcceptProposalOptions | NegotiateProposalOptions | OfferCredentialOptions
  ): Promise<V2CredProposeOfferRequestFormat> {
    if (this.indyIssuerService && proposal.credentialFormats?.indy?.credentialDefinitionId) {
      const credOffer: CredOffer = await this.indyIssuerService.createCredentialOffer(
        proposal.credentialFormats.indy.credentialDefinitionId
      )

      return {
        indy: {
          payload: {
            credentialPayload: credOffer, // old v1 object from Indy SDK
          },
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
   * @param options RequestCredentialOptions the config options for the credential request
   * @throws Error if unable to create the request
   * @returns The created credential offer
   */
  public async createRequest(options: RequestCredentialOptions): Promise<V2CredProposeOfferRequestFormat> {
    if (
      this.indyHolderService &&
      options.holderDid &&
      options.offer &&
      options.offer.indy?.payload.credentialPayload &&
      options.credentialDefinition &&
      options.credentialDefinition.indy?.credentialDefinition
    ) {
      const credoffer: CredOffer = options.offer.indy?.payload.credentialPayload as CredOffer
      const [credReq, credReqMetadata] = await this.indyHolderService.createCredentialRequest({
        holderDid: options.holderDid,
        credentialOffer: credoffer,
        credentialDefinition: options.credentialDefinition.indy?.credentialDefinition,
      })
      const request: V2CredProposeOfferRequestFormat = {
        indy: {
          payload: {
            credentialPayload: credReq,
            requestMetaData: credReqMetadata,
          },
        },
      }
      return request
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

  public processProposal(options: AcceptProposalOptions, credentialRecord: CredentialRecord): AcceptProposalOptions {
    if (credentialRecord.proposalMessage && credentialRecord.proposalMessage.credentialProposal?.attributes) {
      const proposeMessage: V2ProposeCredentialMessage = credentialRecord.proposalMessage as V2ProposeCredentialMessage
      if (proposeMessage && proposeMessage.credentialProposal) {
        options.credentialFormats = {
          indy: {
            attributes: proposeMessage.credentialProposal.attributes,
          },
        }
        return options
      }
    }
    throw Error('Unable to create accept proposal options object')
  }

  /**
   * Gets the attachment object for a given attachId. We need to get out the correct attachId for
   * indy and then find the corresponding attachment (if there is one)
   * @param message Gets the
   * @returns The Attachment if found or undefined
   */
  public getAttachment(message: V2RequestCredentialMessage): Attachment | undefined {
    const indyFormat = message.formats.find((f) => f.format.includes('indy'))
    const attachment = message.requestsAttach.find((attachment) => attachment.id === indyFormat?.attachId)
    return attachment
  }
  private async emitEvent(credentialRecord: CredentialRecord) {
    this.eventEmitter.emit<CredentialStateChangedEvent>({
      type: CredentialEventTypes.CredentialStateChanged,
      payload: {
        credentialRecord,
        previousState: null,
      },
    })
  }
}
