import type { ProblemReportMessageOptions } from '../../../../problem-reports/messages/ProblemReportMessage'

import { Equals } from 'class-validator'

import { ProblemReportMessage } from '../../../../problem-reports/messages/ProblemReportMessage'

export type CredentialProblemReportMessageOptions = ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class V2CredentialProblemReportMessage extends ProblemReportMessage {
  /**
   * Create new CredentialProblemReportMessage instance.
   * @param options
   */
  public constructor(options: CredentialProblemReportMessageOptions) {
    super(options)
  }

  @Equals(V2CredentialProblemReportMessage.type)
  public readonly type = V2CredentialProblemReportMessage.type
  public static readonly type = 'https://didcomm.org/issue-credential/2.0/problem-report'
}
