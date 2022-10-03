import type { ProblemReportMessageOptions } from '../../../../problem-reports/messages/ProblemReportMessage'

import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { ProblemReportMessage } from '../../../../problem-reports/messages/ProblemReportMessage'

export type V2CredentialProblemReportMessageOptions = ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class V2CredentialProblemReportMessage extends ProblemReportMessage {
  /**
   * Create new CredentialProblemReportMessage instance.
   * @param options
   */
  public constructor(options: V2CredentialProblemReportMessageOptions) {
    super(options)
  }

  @IsValidMessageType(V2CredentialProblemReportMessage.type)
  public readonly type = V2CredentialProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/problem-report')
}
