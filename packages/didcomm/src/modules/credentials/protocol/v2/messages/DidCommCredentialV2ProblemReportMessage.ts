import type { DidCommProblemReportMessageOptions } from '../../../../../messages/problem-reports/DidCommProblemReportMessage'

import { DidCommProblemReportMessage } from '../../../../../messages/problem-reports/DidCommProblemReportMessage'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

export type DidCommCredentialV2ProblemReportMessageOptions = DidCommProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class DidCommCredentialV2ProblemReportMessage extends DidCommProblemReportMessage {
  @IsValidMessageType(DidCommCredentialV2ProblemReportMessage.type)
  public readonly type = DidCommCredentialV2ProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/2.0/problem-report')
}
