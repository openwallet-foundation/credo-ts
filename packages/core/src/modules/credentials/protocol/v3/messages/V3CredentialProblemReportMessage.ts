import type { V2ProblemReportMessageOptions } from '../../../../problem-reports/versions/v2/messages'

import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'
import { V2ProblemReportMessage } from '../../../../problem-reports/versions/v2'

export type V3CredentialProblemReportMessageOptions = V2ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class V3CredentialProblemReportMessage extends V2ProblemReportMessage {
  /**
   * Create new CredentialProblemReportMessage instance.
   * @param options
   */
  public constructor(options: V3CredentialProblemReportMessageOptions) {
    super(options)
  }

  @IsValidMessageType(V3CredentialProblemReportMessage.type)
  public readonly type = V3CredentialProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/3.0/problem-report')
}
