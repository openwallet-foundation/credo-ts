import type { DidCommProblemReportMessageOptions } from '../../../../../messages/problem-reports/DidCommProblemReportMessage'
import { DidCommProblemReportMessage } from '../../../../../messages/problem-reports/DidCommProblemReportMessage'
import type { DidCommVersion } from '../../../../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../../../../util/messageType'
import type { DidCommV2PlaintextMessage } from '../../../../../v2/types'

export type DidCommMessagePickupV4ProblemReportMessageOptions = DidCommProblemReportMessageOptions

export class DidCommMessagePickupV4ProblemReportMessage extends DidCommProblemReportMessage {
  public readonly allowQueueTransport = false
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  @IsValidMessageType(DidCommMessagePickupV4ProblemReportMessage.type)
  public readonly type = DidCommMessagePickupV4ProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/message-pickup/4.0/problem-report')

  public toV2Plaintext(): DidCommV2PlaintextMessage {
    const v2: DidCommV2PlaintextMessage = {
      id: this.id,
      type: DidCommMessagePickupV4ProblemReportMessage.type.messageTypeUri,
      body: {
        code: this.description.code,
        comment: this.description.en,
      },
    }
    const parentThreadId = this.thread?.parentThreadId ?? this.thread?.threadId
    if (parentThreadId) v2.pthid = parentThreadId
    return v2
  }
}
