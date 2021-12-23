import { AttachmentFormats, CredentialFormatService } from '../CredentialFormatService'
import { ATTACHMENT_FORMAT, V2CredentialFormatSpec } from '../V2CredentialFormat'
import { ProposeCredentialOptions } from '../../interfaces'
import { Attachment, AttachmentData } from '../../../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../../../utils/JsonEncoder'
import { CredentialPreview } from '../../../CredentialPreview'
import { LinkedAttachment } from '../../../../../utils/LinkedAttachment'
import { CredentialPreviewAttribute } from '../../../CredentialPreviewV2'
import { CredentialRecord } from '../../..'


export class IndyCredentialFormatService extends CredentialFormatService {

  /**
   * Create a {@link AttachmentFormats} object dependent on the message type.
   *
   * @param proposal The object containing all the options for the proposed credential
   * @param messageType the type of message which can be Indy, JsonLd etc eg "CRED_20_PROPOSAL"
   * @returns object containing associated attachment and formats elements
   *
   */
  public getCredentialProposeAttachFormats(proposal: ProposeCredentialOptions, messageType: string): AttachmentFormats {
    let preview: CredentialPreview | undefined

    if (proposal?.credentialFormats.indy?.attributes) {
      preview = new CredentialPreview({ attributes: proposal?.credentialFormats.indy?.attributes })
    }
    const formats: V2CredentialFormatSpec = this.getFormatIdentifier(messageType)
    const filtersAttach: Attachment = this.getFormatData(messageType, proposal)

    return { preview, formats, filtersAttach }
  }

  /**
   * set the meta data for indy credentials
   */
  private setMetaData(credentialRecord: CredentialRecord, proposal?: ProposeCredentialOptions): void {
    if (proposal) {
      credentialRecord.metadata.set('_internal/indyCredential', {
        schemaId: proposal.credentialFormats.indy?.schemaId,
        credentialDefinintionId: proposal.credentialFormats.indy?.credentialDefinitionId,
      })
    }
  }
  /**
   * Save the meta data and emit event
   */
  public async setMetaDataAndEmitEvent(proposal: ProposeCredentialOptions, credentialRecord: CredentialRecord): Promise<void> {
    this.setMetaData(credentialRecord, proposal)
    return await super.emitEvent(credentialRecord)
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
  public getCredentialLinkedAttachments(proposal: ProposeCredentialOptions): LinkedAttachment[] | undefined {
    return proposal.credentialFormats.indy?.linkedAttachments
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
   * @param message_type The message type for which to return the cred format.
   *       Should be one of the message types defined in the message types file
   * @param data The data to include in the attach object
   * @returns attachment to the credential proposal
   */
  getFormatData(messageType: string, data: ProposeCredentialOptions): Attachment {
    return new Attachment({
      id: 'indy',
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(data),
      }),
    })
  }

}

