import type { ProblemReportMessageOptions } from '../../problem-reports/messages/ProblemReportMessage'

import { Equals } from 'class-validator'

import { ProblemReportMessage } from '../../problem-reports/messages/ProblemReportMessage'

export type DidExchangeProblemReportMessageOptions = ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class DidExchangeProblemReportMessage extends ProblemReportMessage {
  public constructor(options: DidExchangeProblemReportMessageOptions) {
    super(options)
  }

  @Equals(DidExchangeProblemReportMessage.type)
  public readonly type = DidExchangeProblemReportMessage.type
  public static readonly type = 'https://didcomm.org/didexchange/1.0/problem-report'
}
