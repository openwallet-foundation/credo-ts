/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AgentMessage } from '../../../../../src/agent/AgentMessage'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type {
  AcceptCredentialOptions,
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../interfaces'
import type { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttributes'
import type { V1CredentialPreview } from '../../protocol/v1/V1CredentialPreview'
import type { CredentialExchangeRecord } from '../../repository/CredentialRecord'
import type {
  CredentialAttachmentFormats,
  CredentialFormatSpec,
  CredProposeOfferRequestFormat,
  HandlerAutoAcceptOptions,
  OfferAttachmentFormats,
} from '../models/CredentialFormatServiceOptions'

import { AttachmentData } from '../../../../decorators/attachment/Attachment'
import { uuid } from '../../../../utils/uuid'
import { CredentialFormatService } from '../CredentialFormatService'

export class JsonLdCredentialFormatService extends CredentialFormatService {
  processProposal(
    options: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<AcceptProposalOptions> {
    throw new Error('Method not implemented.')
  }
  createOffer(options: AcceptProposalOptions): Promise<OfferAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  createRequest(
    options: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  createCredential(
    options: AcceptRequestOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  shouldAutoRespondToProposal(options: HandlerAutoAcceptOptions): boolean {
    throw new Error('Method not implemented.')
  }
  shouldAutoRespondToRequest(options: HandlerAutoAcceptOptions): boolean {
    throw new Error('Method not implemented.')
  }
  shouldAutoRespondToCredential(options: HandlerAutoAcceptOptions): boolean {
    throw new Error('Method not implemented.')
  }
  processOffer(options: AcceptProposalOptions, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }
  processCredential(options: AcceptCredentialOptions, credentialRecord: CredentialExchangeRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  processRequest(options: RequestCredentialOptions, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }

  public createProposal(options: ProposeCredentialOptions): CredentialAttachmentFormats {
    const format: CredentialFormatSpec = {
      attachId: 'ld_proof',
      format: 'aries/ld-proof-vc-detail@v1.0',
    }

    const attachment: Attachment = this.getFormatData(options.credentialFormats.jsonld, format.attachId)
    // Q: How do we handle linked attachments?
    // const { previewWithAttachments } = this.getCredentialLinkedAttachments(options)
    // return { format: formats, attachment, preview: previewWithAttachments }
    return { format, attachment }
  }
}
