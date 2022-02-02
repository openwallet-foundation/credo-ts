import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type { ProofFormatSpec } from './ProofFormatSpec'

export interface ProofAttachmentFormat {
  format: ProofFormatSpec
  attachment: Attachment
}
