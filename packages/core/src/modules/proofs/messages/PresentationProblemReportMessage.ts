import type { ProblemReportMessageOptions } from '../../problem-reports/messages/ProblemReportMessage'

import { Equals } from 'class-validator'

import { ProblemReportMessage } from '../../problem-reports/messages/ProblemReportMessage'
import { parseMessageType } from '../../../utils/messageType'

export type PresentationProblemReportMessageOptions = ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class PresentationProblemReportMessage extends ProblemReportMessage {
  /**
   * Create new PresentationProblemReportMessage instance.
   * @param options
   */
  public constructor(options: PresentationProblemReportMessageOptions) {
    super(options)
  }

  @Equals(PresentationProblemReportMessage.type)
  public readonly type = PresentationProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/problem-report')
}
