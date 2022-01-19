import type { Attachment } from '../../../../../decorators/attachment/Attachment'
import type { ProposeProofOptions, V2ProposeProofFormat } from '../../../interface'
import type { ProofRecord } from '../../../repository'
import type { V2AttachmentFormats } from '../ProofFormatService'
import type { V2ProofFormatSpec } from '../V2ProofFormat'

import { ConsoleLogger, LogLevel } from '../../../../../logger'
import { ProofFormatService } from '../ProofFormatService'

const logger = new ConsoleLogger(LogLevel.debug)

export class JsonLdProofFormatService extends ProofFormatService {
  public setMetaDataAndEmitEventForProposal(proposal: V2ProposeProofFormat, proofRecord: ProofRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public getProofProposeAttachFormats(proposal: ProposeProofOptions, messageType: string): V2AttachmentFormats {
    logger.debug(proposal.connectionId) // temp used to avoid lint errors
    logger.debug(messageType) // temp used to avoid lint errors

    throw new Error('Method not implemented.')
  }

  public getFormatIdentifier(messageType: string): V2ProofFormatSpec {
    logger.debug(messageType) // temp used to avoid lint errors

    throw new Error('Method not implemented.')
  }

  public getFormatData(data: V2ProposeProofFormat): Attachment[] {
    logger.debug(data.toString()) // temp used to avoid lint errors

    throw new Error('Method not implemented.')
  }
}
