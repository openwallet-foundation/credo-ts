import type { ProblemReportMessageOptions } from '../../../../problem-reports/messages/ProblemReportMessage'

import { Equals } from 'class-validator'

import { ProblemReportMessage } from '../../../../problem-reports/messages/ProblemReportMessage'

export type V2PresentationProblemReportMessageOptions = ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class V2PresentationProblemReportMessage extends ProblemReportMessage {
  /**
   * Create new PresentationProblemReportMessage instance.
   * @param options
   */
  public constructor(options: V2PresentationProblemReportMessageOptions) {
    super(options)
  }

  @Equals(V2PresentationProblemReportMessage.type)
  public readonly type = V2PresentationProblemReportMessage.type
  public static readonly type = 'https://didcomm.org/present-proof/2.0/problem-report'
}
