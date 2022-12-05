import type { Attachment } from '../../../../decorators/attachment/v1/Attachment'
import type { ProofFormatSpec } from '../../models/ProofFormatSpec'

export interface ProofAttachmentFormat {
  format: ProofFormatSpec
  attachment: Attachment
}
