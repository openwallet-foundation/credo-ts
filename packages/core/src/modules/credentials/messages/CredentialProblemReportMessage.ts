import type { ProblemReportMessageOptions } from '../../problem-reports/messages/ProblemReportMessage'

import { IsValidMessageType, parseMessageType } from '../../../utils/messageType'
import { ProblemReportMessage } from '../../problem-reports/messages/ProblemReportMessage'

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

  @IsValidMessageType(CredentialProblemReportMessage.type)
  public readonly type = CredentialProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/problem-report')
}
