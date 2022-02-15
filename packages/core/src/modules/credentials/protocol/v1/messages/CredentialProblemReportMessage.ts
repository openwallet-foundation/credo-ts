import type { ProblemReportMessageOptions } from '../../../../problem-reports/messages/ProblemReportMessage'

import { Equals } from 'class-validator'

import { ProblemReportMessage } from '../../../../problem-reports/messages/ProblemReportMessage'

export type CredentialProblemReportMessageOptions = ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class CredentialProblemReportMessage extends ProblemReportMessage {
  /**
   * Create new CredentialProblemReportMessage instance.
   * @param options
   */
  public constructor(options: CredentialProblemReportMessageOptions) {
    super(options)
  }

  @Equals(CredentialProblemReportMessage.type)
  public readonly type = CredentialProblemReportMessage.type
  public static readonly type = 'https://didcomm.org/issue-credential/1.0/problem-report'
}
