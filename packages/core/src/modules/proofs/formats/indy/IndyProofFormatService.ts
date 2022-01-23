import type { CreateProposalOptions } from '../../models/ServiceOptions'
import type {
  CreatePresentationOptions,
  CreateRequestOptions,
  ProcessProposalOptions,
  ProofAttachmentFormat,
} from '../ProofFormatService'

import { ProofFormatService } from '../ProofFormatService'

import { Attachment, AttachmentData } from 'packages/core/src/decorators/attachment/Attachment'
import { JsonEncoder } from 'packages/core/src/utils'

export class IndyProofFormatService extends ProofFormatService {
  public createProposal(options: CreateProposalOptions): ProofAttachmentFormat {
    throw new Error('Method not implemented.')
  }

  public processProposal(options: ProcessProposalOptions): void {
    throw new Error('Method not implemented.')
  }

  public createRequest(options: CreateRequestOptions): ProofAttachmentFormat {
    const { attachId, proofRequest } = options
    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(proofRequest),
      }),
    })
    return { attachment }
  }

  public processRequest(options: ProcessRequestOptions): void {
    throw new Error('Method not implemented.')
  }

  public createPresentation(options: CreatePresentationOptions): ProofAttachmentFormat {
    const { attachId, attachData } = options
    const attachment = new Attachment({
      id: attachId,
      mimeType: 'application/json',
      data: attachData,
    })
    return { attachment }
  }

  public processPresentation(options: ProcessPresentationOptions): void {
    throw new Error('Method not implemented.')
  }
}
