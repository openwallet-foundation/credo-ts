// Create a base ProblemReportMessage message class for DIDComm V2
import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose } from 'class-transformer'
import { Equals, IsString } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'

export type ProblemReportV2MessageOptions = DIDCommV2MessageParams & {
  pthid: string
  body: ProblemReportV2
}

export interface ProblemReportV2 {
  code: string
  comment?: string
  escalate_to?: string
  args?: any[]
}

export class ProblemReportV2Message extends DIDCommV2Message {
  public constructor(options?: ProblemReportV2MessageOptions) {
    super(options)
    if (options) {
      this.pthid = options.pthid
    }
  }

  @Equals(ProblemReportV2Message.type)
  public readonly type: string = ProblemReportV2Message.type
  public static readonly type: string = 'https://didcomm.org/report-problem/2.0/problem-report'

  @Expose({ name: 'body' })
  public body!: ProblemReportV2

  @IsString()
  public pthid!: string
}
