import type { V1Attachment } from '../../../../decorators/attachment/V1Attachment'
import type { ProofFormatSpec } from '../../models/ProofFormatSpec'

export interface ProofAttachmentFormat {
  format: ProofFormatSpec
  attachment: V1Attachment
}
