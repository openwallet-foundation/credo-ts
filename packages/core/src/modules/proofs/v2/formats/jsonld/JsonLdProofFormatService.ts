import type { Attachment } from '../../../../../decorators/attachment/Attachment'
import type { ProofRecord } from '../../../repository'
import type { ProposeProofOptions, V2ProposeProofFormat } from '../../interface'
import type { V2AttachmentFormats } from '../ProofFormatService'
import type { V2ProofFormatSpec } from '../V2ProofFormat'

import { ProofFormatService } from '../ProofFormatService'

export class JsonLdProofFormatService extends ProofFormatService {
  public save(proposal: ProposeProofOptions, proofRecord: ProofRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public getProofProposeAttachFormats(proposal: ProposeProofOptions, messageType: string): V2AttachmentFormats {
    throw new Error('Method not implemented.')
  }

  public getFormatIdentifier(messageType: string): V2ProofFormatSpec {
    throw new Error('Method not implemented.')
  }

  public getFormatData(data: V2ProposeProofFormat): Attachment[] {
    throw new Error('Method not implemented.')
  }
}
