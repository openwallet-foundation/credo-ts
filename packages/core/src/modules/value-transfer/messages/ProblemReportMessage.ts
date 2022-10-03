import type { ProblemReportV2MessageOptions } from '../../problem-reports'

import { ProblemReport } from '@sicpa-dlab/value-transfer-protocol-ts'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'
import { ProblemReportV2Message } from '../../problem-reports'

export class ProblemReportMessage extends ProblemReportV2Message {
  public constructor(options?: ProblemReportV2MessageOptions) {
    super(options)
  }

  @IsValidMessageType(ProblemReportMessage.type)
  public readonly type = ProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType(ProblemReport.type)
}
