import type { ProblemReportMessageOptions } from '@credo-ts/didcomm'

import { IsValidMessageType, ProblemReportMessage, parseMessageType } from '@credo-ts/didcomm'

export type V1PresentationProblemReportMessageOptions = ProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class V1PresentationProblemReportMessage extends ProblemReportMessage {
  public readonly allowDidSovPrefix = true

  @IsValidMessageType(V1PresentationProblemReportMessage.type)
  public readonly type = V1PresentationProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/present-proof/1.0/problem-report')
}
