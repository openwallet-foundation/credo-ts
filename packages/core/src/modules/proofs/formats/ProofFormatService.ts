import type { ProofRecord } from '..'
import type { Attachment } from '../../../decorators/attachment/Attachment'

import { Expose, Type } from 'class-transformer'
import { IsInstance, IsString, ValidateNested } from 'class-validator'

interface ProofFormatSpecOptions {
  attachmentId: string
  format: string
}

class ProofFormatSpec {
  public constructor(options: ProofFormatSpecOptions) {
    if (options) {
      this.attachmentId = options.attachmentId
      this.format = options.format
    }
  }

  @Expose({ name: 'attach_id' })
  public attachmentId!: string

  @IsString()
  public format!: string
}

interface ProofAttachmentFormat {
  format: ProofFormatSpec
  attachment: Attachment
}

interface CreateProposalOptions {
  record: ProofRecord
}

interface ProcessProposalOptions {
  record: ProofRecord
  proposal: ProofAttachmentFormat
  options: never // TBD
}

interface CreateRequestOptions {
  record: ProofRecord
}

interface ProcessRequestOptions {
  record: ProofRecord
  request: ProofAttachmentFormat
  options: never // TBD
}

interface CreatePresentationOptions {
  record: ProofRecord
}

interface ProcessPresentationOptions {
  record: ProofRecord
  presentation: ProofAttachmentFormat
  options: never // TBD
}

/**
 * This abstract class is the base class for any proof format
 * specific service.
 *
 * @export
 * @abstract
 * @class ProofFormatService
 */
export abstract class ProofFormatService {
  abstract createProposal(options: CreateProposalOptions): ProofAttachmentFormat

  abstract processProposal(options: ProcessProposalOptions): void

  abstract createRequest(options: CreateRequestOptions): ProofAttachmentFormat

  abstract processRequest(options: ProcessRequestOptions): void

  abstract createPresentation(options: CreatePresentationOptions): ProofAttachmentFormat

  abstract processPresentation(options: ProcessPresentationOptions): void

  // abstract getRequestedCredentialsForProofRequest(record: ProofRecord):
}
