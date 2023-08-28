import type { V2ProblemReportMessageOptions } from '../../../../problem-reports/versions/v2/messages'

import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { V2ProblemReportMessage } from '../../../../problem-reports/versions/v2'

export type V3PresentationProblemReportMessageOptions = V2ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class V3PresentationProblemReportMessage extends V2ProblemReportMessage {
  /**
   * Create new V3PresentationProblemReportMessage instance.
   * @param options
   */
  public constructor(options: V3PresentationProblemReportMessageOptions) {
    super(options)
  }

  @IsValidMessageType(V3PresentationProblemReportMessage.type)
  public readonly type = V3PresentationProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/3.0/problem-report')
}
