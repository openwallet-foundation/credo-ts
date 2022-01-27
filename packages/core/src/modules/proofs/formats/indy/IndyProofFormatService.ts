import type { CreateProposalOptions } from '../../models/ServiceOptions'
import type {
  CreatePresentationOptions,
  CreateRequestOptions,
  ProcessProposalOptions,
  ProcessRequestOptions,
  ProofAttachmentFormat,
  ProofFormatSpec,
} from '../ProofFormatService'

import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../../utils/JsonEncoder'
import { ProofFormatService } from '../ProofFormatService'
import { ATTACHMENT_FORMAT } from '../ProofFormats'

export class IndyProofFormatService extends ProofFormatService {
  public createProposal(options: CreateProposalOptions): ProofAttachmentFormat {
    // Handle format in service
    throw new Error('Method not implemented.')
  }

  public processProposal(options: ProcessProposalOptions): void {
    throw new Error('Method not implemented.')
  }

  public createRequest(options: CreateRequestOptions): ProofAttachmentFormat {
    const format: ProofFormatSpec = this.getFormatIdentifier(options.messageType)

    const { attachId, proofRequest } = options
    const attachment = new Attachment({
      id: attachId ? attachId : undefined,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(proofRequest),
      }),
    })
    return { format, attachment }
  }

  public processRequest(options: ProcessRequestOptions): void {
    throw new Error('Method not implemented.')
  }

  public createPresentation(options: CreatePresentationOptions): ProofAttachmentFormat {
    const format: ProofFormatSpec = this.getFormatIdentifier(options.messageType)

    const { attachId, attachData } = options
    const attachment = new Attachment({
      id: attachId ? attachId : undefined,
      mimeType: 'application/json',
      data: attachData,
    })
    return { format, attachment }
  }

  public processPresentation(options: ProcessPresentationOptions): void {
    throw new Error('Method not implemented.')
  }

  /**
   * Get attachment format identifier for format and message combination
   *
   * @param messageType Message type for which to return the format identifier
   * @return V2CredentialFormatSpec - Issue credential attachment format identifier
   */
  public getFormatIdentifier(messageType: string): ProofFormatSpec {
    return ATTACHMENT_FORMAT[messageType].indy
  }
}
