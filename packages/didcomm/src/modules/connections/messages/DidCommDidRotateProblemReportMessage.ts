import type { DidCommProblemReportMessageOptions } from '../../../messages'

import { DidCommProblemReportMessage } from '../../../messages'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export type DidCommDidRotateProblemReportMessageOptions = DidCommProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class DidCommDidRotateProblemReportMessage extends DidCommProblemReportMessage {
  @IsValidMessageType(DidCommDidRotateProblemReportMessage.type)
  public readonly type = DidCommDidRotateProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/did-rotate/1.0/problem-report')
}
