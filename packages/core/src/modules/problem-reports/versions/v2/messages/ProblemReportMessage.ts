// Base ProblemReportMessage message class for DIDComm V2
import type { DidCommV2MessageParams } from '../../../../../didcomm/versions/v2'

import { Expose } from 'class-transformer'
import { IsOptional, IsString } from 'class-validator'

import { DidCommV2Message } from '../../../../../didcomm'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export type V2ProblemReportMessageOptions = DidCommV2MessageParams & {
  parentThreadId: string
  body: ProblemReportBody
}

export class ProblemReportBody {
  @IsString()
  public code!: string

  @IsString()
  public comment!: string

  @Expose({ name: 'escalate_to' })
  public escalateTo?: string

  @IsOptional()
  @IsString({ each: true })
  public args?: string[]
}

export class V2ProblemReportMessage extends DidCommV2Message {
  public constructor(options?: V2ProblemReportMessageOptions) {
    super(options)
    if (options) {
      this.parentThreadId = options.parentThreadId
      this.body = options.body
    }
  }

  @IsValidMessageType(V2ProblemReportMessage.type)
  public readonly type = V2ProblemReportMessage.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/report-problem/2.0/problem-report')

  @Expose({ name: 'body' })
  public body!: ProblemReportBody

  @Expose({ name: 'pthid' })
  @IsString()
  public parentThreadId!: string
}
