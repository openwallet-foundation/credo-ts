import type { DidCommProblemReportMessageOptions } from '@credo-ts/didcomm'

import { IsValidMessageType, DidCommProblemReportMessage, parseMessageType } from '@credo-ts/didcomm'

export type V1CredentialProblemReportMessageOptions = DidCommProblemReportMessageOptions

/**
 * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0035-report-problem/README.md
 */
export class DidCommCredentialV1ProblemReportMessage extends DidCommProblemReportMessage {
  public readonly allowDidSovPrefix = true

  @IsValidMessageType(DidCommCredentialV1ProblemReportMessage.type)
  public readonly type = DidCommCredentialV1ProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/issue-credential/1.0/problem-report')
}
