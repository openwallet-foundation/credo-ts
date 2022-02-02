import type { ProposeProofFormats } from '../../models/SharedOptions'
import type { ProofRequestOptions } from '../../protocol/v1/models'
import type { ProofAttachmentFormat } from '../models/ProofAttachmentFormat'
import type {
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestAttachmentOptions,
  CreateRequestOptions,
  ProcessProposalOptions,
  ProcessRequestOptions,
} from '../models/ProofFormatServiceOptions'
import type { ProofFormatSpec } from '../models/ProofFormatSpec'

import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { JsonEncoder } from '../../../../utils/JsonEncoder'
import { ProofRequest } from '../../protocol/v1/models'
import { ProofFormatService } from '../ProofFormatService'
import { ATTACHMENT_FORMAT } from '../ProofFormats'

export class IndyProofFormatService extends ProofFormatService {
  private createRequestAttachment(options: CreateRequestAttachmentOptions) {
    const format: ProofFormatSpec = this.getFormatIdentifier(options.messageType)

    const request = new ProofRequest(options.proofRequestOptions)

    const attachment = new Attachment({
      id: options.attachId,
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(request),
      }),
    })
    return { format, attachment }
  }

  public createProposal(options: CreateProposalOptions): ProofAttachmentFormat {
    if (!options.formats.indy) {
      throw Error('Indy format missing')
    }

    return this.createRequestAttachment({
      attachId: options.attachId,
      messageType: options.messageType,
      proofRequestOptions: options.formats.indy,
    })
  }

  public processProposal(options: ProcessProposalOptions): void {
    throw new Error('Method not implemented.')
  }

  public createRequest(options: CreateRequestOptions): ProofAttachmentFormat {
    if (!options.formats.indy) {
      throw new AriesFrameworkError(
        'Unable to get requested credentials for proof request. No proof request message was found or the proof request message does not contain an indy proof request.'
      )
    }

    return this.createRequestAttachment({
      attachId: options.attachId,
      messageType: options.messageType,
      proofRequestOptions: options.formats.indy,
    })
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
