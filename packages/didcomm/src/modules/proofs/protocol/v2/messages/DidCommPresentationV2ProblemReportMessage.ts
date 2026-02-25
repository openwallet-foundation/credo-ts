import { DidCommProblemReportMessage } from '../../../../../messages'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class DidCommPresentationV2ProblemReportMessage extends DidCommProblemReportMessage {
  @IsValidMessageType(DidCommPresentationV2ProblemReportMessage.type)
  public readonly type = DidCommPresentationV2ProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/2.0/problem-report')
}
