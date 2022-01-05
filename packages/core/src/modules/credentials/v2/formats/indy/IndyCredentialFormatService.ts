import { V2AttachmentFormats, CredentialFormatService } from '../CredentialFormatService'
import { ATTACHMENT_FORMAT, V2CredentialFormatSpec } from '../V2CredentialFormat'
import { AcceptProposalOptions, ProposeCredentialOptions, V2CredOfferFormat, V2CredProposalFormat } from '../../interfaces'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { CredentialPreview } from '../../../CredentialPreview'
import { LinkedAttachment } from '../../../../../utils/LinkedAttachment'
import { CredentialPreviewAttribute } from '../../../CredentialPreview'
import { CredentialRecord, CredentialRepository, CredentialUtils } from '../../..'
import { IndyIssuerService } from '../../../../indy'
import { EventEmitter } from '../../../../../agent/EventEmitter'
import { CredOffer } from 'indy-sdk'
import { INDY_CREDENTIAL_OFFER_ATTACHMENT_ID, V2OfferCredentialMessage } from '../../messages/V2OfferCredentialMessage'

export class IndyCredentialFormatService extends CredentialFormatService {

  private indyIssuerService?: IndyIssuerService
  protected credentialRepository: CredentialRepository

  public constructor(
    credentialRepository: CredentialRepository,
    eventEmitter: EventEmitter,
    indyIssuerService?: IndyIssuerService
  ) {
    super(credentialRepository, eventEmitter)
    this.credentialRepository = credentialRepository
    this.indyIssuerService = indyIssuerService
  }
  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the proposed credential
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_PROPOSAL"
   * @returns object containing associated attachment, formats and filtersAttach elements
   *
   */
  public getCredentialProposeAttachFormats(proposal: ProposeCredentialOptions, messageType: string): V2AttachmentFormats {
    let preview: CredentialPreview | undefined

    if (proposal?.credentialFormats.indy?.attributes) {
      preview = new CredentialPreview({ attributes: proposal?.credentialFormats.indy?.attributes })
    }
    const formats: V2CredentialFormatSpec = this.getFormatIdentifier(messageType)
    const filtersAttach: Attachment[] = this.getFormatData(proposal.credentialFormats)

    return { preview, formats, filtersAttach }
  }

  /**
  * Create a {@link AttachmentFormats} object dependent on the message type.
  *
  * @param proposal The object containing all the options for the credential offer
  * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_OFFER"
  * @returns object containing associated attachment, formats and offersAttach elements
  *
  */
  public getCredentialOfferAttachFormats(proposal: AcceptProposalOptions, messageType: string): V2AttachmentFormats {
    let preview: CredentialPreview | undefined

    if (proposal?.credentialFormats.indy?.attributes) {
      preview = new CredentialPreview({ attributes: proposal?.credentialFormats.indy?.attributes })
    }
    const formats: V2CredentialFormatSpec = this.getFormatIdentifier(messageType)
    const offersAttach: Attachment[] = this.getFormatData(proposal.credentialFormats)

    return { preview, formats, offersAttach }
  }
  /**
   * Save the meta data and emit event for a credential proposal
   * @param proposal wrapper object that contains either indy or some other format of proposal, in this case indy. 
   * see {@link V2CredProposalFormat}
   * @param credentialRecord the record containing attributes for this credentual
   */
  public async setMetaDataAndEmitEventForProposal(proposal: V2CredProposalFormat, credentialRecord: CredentialRecord): Promise<void> {
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
      schemaId: offer.indy?.offer.schema_id,
      credentialDefinintionId: offer.indy?.offer.cred_def_id,
    })
  }

  /**
   * Get attachment format identifier for format and message combination
   * 
   * @param messageType Message type for which to return the format identifier
   * @return V2CredentialFormatSpec - Issue credential attachment format identifier
   */
  getFormatIdentifier(messageType: string): V2CredentialFormatSpec {
    return ATTACHMENT_FORMAT[messageType].indy
  }


  /**
   * 
   * @param proposal Gets the credential definition id if present for an indy credential
   * @returns the credential definition id for this credential
   */
  public getCredentialDefinitionId(proposal: ProposeCredentialOptions): string | undefined {
    return proposal.credentialFormats.indy?.credentialDefinitionId

  }

  /**
   * Get linked attachments for indy format from a proposal message. This allows attachments
   * to be copied across to old style credential records
   * 
   * @param proposal ProposeCredentialOptions object containing (optionally) the linked attachments
   * @return array of linked attachments or undefined if none present
   */
  public getCredentialLinkedAttachments(proposal: ProposeCredentialOptions): Attachment[] | undefined {

    // Add the linked attachments to the credentialProposal

    let attachments: Attachment[] | undefined
    let preview: CredentialPreview
    // if (proposal.credentialFormats.indy && proposal.credentialFormats.indy?.linkedAttachments) {
    //   preview= CredentialUtils.createAndLinkAttachmentsToPreview(
    //     proposal.credentialFormats.indy.linkedAttachments,
    //     new CredentialPreview({ attributes: proposal.credentialFormats.indy?.attributes})
    //   )
    //   attachments = proposal.credentialFormats.indy.linkedAttachments.map((linkedAttachment) => linkedAttachment.attachment)
    // }

    return attachments

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
  public getFormatData(data: V2CredProposalFormat | V2CredOfferFormat): Attachment[] {

    const offersAttach: Attachment[] = []

    offersAttach.push(new Attachment({
      id: 'indy',
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(data.indy),
      }),
    }))

    return offersAttach
  }

  /**
    * Create a credential offer for the given credential definition id.
    *
    * @param credentialDefinitionId The credential definition to create an offer for
    * @returns The created credential offer
    */
  public async createCredentialOffer(proposal: AcceptProposalOptions): Promise<V2CredOfferFormat> {
    if (this.indyIssuerService && proposal.credentialFormats?.indy?.credentialDefinitionId) {
      const credOffer: CredOffer = await this.indyIssuerService.createCredentialOffer(proposal.credentialFormats.indy.credentialDefinitionId)

      return {
        indy: {
          offer: credOffer // old v1 object from Indy SDK
        }
      }
    }

    if (!this.indyIssuerService) {
      throw new Error("Missing Indy Issuer Service")
    } else {
      throw new Error("Missing Credential Definition id")
    }
  }

  /**
   * Extracts the data from the base64 encoded attachment payload of a credential offer and maps 
   * it to a {@link V2CredOfferFormat} object
   * @param credentialOfferMessage the incoming credential offer message
   * @returns the credntial offer with an indy specific {@CredOffer} - this is from the Indy SDK
   */
  public getCredentialOfferMessage(credentialOfferMessage: V2OfferCredentialMessage): V2CredOfferFormat {
    const attachment = credentialOfferMessage.offerAttachments.find((attachment) => attachment.id === INDY_CREDENTIAL_OFFER_ATTACHMENT_ID)

    // Extract credential offer from attachment
    const credentialOfferJson = attachment?.data?.getDataAsJson<CredOffer>() ?? null

    if (credentialOfferJson) {
      return {
        indy: {
          offer: credentialOfferJson
        }
      }
    }
    throw Error("No json object found for the credential offer")
  }
}

