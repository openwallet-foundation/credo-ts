import type { DidCommProblemReportMessageOptions } from '@credo-ts/didcomm'

import { DidCommProblemReportMessage, IsValidMessageType, parseMessageType } from '@credo-ts/didcomm'

export type ActionMenuProblemReportMessageOptions = DidCommProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 * @internal
 */
export class ActionMenuProblemReportMessage extends DidCommProblemReportMessage {
  @IsValidMessageType(ActionMenuProblemReportMessage.type)
  public readonly type = ActionMenuProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/action-menu/1.0/problem-report')
}
