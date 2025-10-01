import type { DidCommProblemReportMessageOptions } from '../../../messages'

import { DidCommProblemReportMessage } from '../../../messages'
import { IsValidMessageType, parseMessageType } from '../../../util/messageType'

export type DidCommConnectionProblemReportMessageOptions = DidCommProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class DidCommConnectionProblemReportMessage extends DidCommProblemReportMessage {
  public readonly allowDidSovPrefix = true

  @IsValidMessageType(DidCommConnectionProblemReportMessage.type)
  public readonly type = DidCommConnectionProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/connection/1.0/problem-report')
}
