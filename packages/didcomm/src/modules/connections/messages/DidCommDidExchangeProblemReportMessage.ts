import type { DidCommProblemReportMessageOptions } from '../../../messages'

import { DidCommProblemReportMessage } from '../../../messages'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export type DidCommDidExchangeProblemReportMessageOptions = DidCommProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class DidCommDidExchangeProblemReportMessage extends DidCommProblemReportMessage {
  @IsValidMessageType(DidCommDidExchangeProblemReportMessage.type)
  public readonly type = DidCommDidExchangeProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/didexchange/1.1/problem-report')
}
