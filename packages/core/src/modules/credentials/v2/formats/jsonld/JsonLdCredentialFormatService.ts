import { V2AttachmentFormats, CredentialFormatService } from '../CredentialFormatService'
import { V2CredentialFormatSpec } from '../V2CredentialFormat'
import { Attachment } from 'packages/core/src/decorators/attachment/Attachment'
import { AcceptProposalOptions, ProposeCredentialOptions, V2CredOfferFormat, V2CredProposalFormat } from '../../interfaces'
import { LinkedAttachment } from 'packages/core/src/utils/LinkedAttachment'
import { V1CredentialPreview, CredentialPreviewAttribute } from '../../../v1/V1CredentialPreview'
import { CredentialRecord } from '../../..'
import { V2OfferCredentialMessage } from '../../messages/V2OfferCredentialMessage'

export class JsonLdCredentialFormatService extends CredentialFormatService {
  setPreview(proposal: AcceptProposalOptions, preview?: V1CredentialPreview): AcceptProposalOptions {
    throw new Error('Method not implemented.')
  }
  getCredentialLinkedAttachments(proposal: ProposeCredentialOptions): { attachments: Attachment[] | undefined; previewWithAttachments: V1CredentialPreview } {
    throw new Error('Method not implemented.')
  }
  setMetaDataAndEmitEventForProposal(proposal: V2CredProposalFormat, credentialRecord: CredentialRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  getFormatData(data: V2CredOfferFormat | V2CredProposalFormat): Attachment[] {
    throw new Error('Method not implemented.')
  }
  getCredentialOfferMessage(credentialOfferMessage: V2OfferCredentialMessage): V2CredOfferFormat {
    throw new Error('Method not implemented.')
  }
  setMetaDataForOffer(offer: V2CredOfferFormat, credentialRecord: CredentialRecord): void {
    throw new Error('Method not implemented.')
  }
  createCredentialOffer(proposal: AcceptProposalOptions): Promise<V2CredOfferFormat> {
    throw new Error('Method not implemented.')
  }
  getCredentialOfferAttachFormats(proposal: AcceptProposalOptions, messageType: string): V2AttachmentFormats {
    throw new Error('Method not implemented.')
  }
  getCredentialDefinitionId(proposal: ProposeCredentialOptions): string | undefined {
    throw new Error('Method not implemented.')
  }
  getCredentialAttributes(proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined {
    throw new Error('Method not implemented.')
  }
  setMetaDataAndEmitEvent(proposal: ProposeCredentialOptions, credentialRecord: CredentialRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  getCredentialProposeAttachFormats(proposal: ProposeCredentialOptions, messageType: string): V2AttachmentFormats {
    throw new Error('Method not implemented.')
  }
  getFormatIdentifier(messageType: string): V2CredentialFormatSpec {
    throw new Error('Method not implemented.')
  }

}