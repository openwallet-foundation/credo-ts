import type { DidCommProblemReportMessageOptions } from '@credo-ts/didcomm'

import { IsValidMessageType, DidCommProblemReportMessage, parseMessageType } from '@credo-ts/didcomm'

export type DidCommPresentationV1ProblemReportMessageOptions = DidCommProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class DidCommPresentationV1ProblemReportMessage extends DidCommProblemReportMessage {
  public readonly allowDidSovPrefix = true

  @IsValidMessageType(DidCommPresentationV1ProblemReportMessage.type)
  public readonly type = DidCommPresentationV1ProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/problem-report')
}
