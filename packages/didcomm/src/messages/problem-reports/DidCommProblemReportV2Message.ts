import { Expose } from 'class-transformer'
import { IsArray, IsOptional, IsString } from 'class-validator'

import { DidCommMessage } from '../../DidCommMessage'
import { PthidRegExp } from '../../decorators/thread/ThreadDecorator'
import type { DidCommVersion } from '../../util/didcommVersion'
import { IsValidMessageType, parseMessageType } from '../../util/messageType'
import type { DidCommV2PlaintextMessage } from '../../v2/types'
import type { DidCommProblemReportMessage } from './DidCommProblemReportMessage'

export interface DidCommProblemReportV2MessageOptions {
  id?: string
  parentThreadId: string
  ack?: string[]
  code: string
  comment?: string
  args?: unknown[]
  escalateTo?: string
}

/**
 * @see https://identity.foundation/didcomm-messaging/spec/v2.1/#problem-reports
 */
export class DidCommProblemReportV2Message extends DidCommMessage {
  public readonly supportedDidCommVersions: DidCommVersion[] = ['v2']

  public constructor(options: DidCommProblemReportV2MessageOptions) {
    super()

    if (options) {
      this.id = options.id || this.generateId()
      this.setThread({ parentThreadId: options.parentThreadId })
      this.ack = options.ack
      this.code = options.code
      this.comment = options.comment
      this.args = options.args
      this.escalateTo = options.escalateTo
    }
  }

  // Codes are lower kebab-case and comment is static per code: https://identity.foundation/didcomm-messaging/spec/v2.1/#problem-reports
  public static fromProblemReportMessage(
    { description }: DidCommProblemReportMessage,
    { id, threadId }: { id: string; threadId?: string }
  ): DidCommProblemReportV2Message | undefined {
    // pthid is REQUIRED and an id that does not match PthidRegExp would make the sender reject the report
    if (!PthidRegExp.test(id)) return undefined

    const problemReport = new DidCommProblemReportV2Message({
      parentThreadId: threadId && PthidRegExp.test(threadId) ? threadId : id,
      ack: [id],
      code: /^[a-z0-9]+(-[a-z0-9]+)*$/.test(description.code) ? `e.p.msg.${description.code}` : 'e.p.msg',
      comment: 'Bad message: {1}',
      args: [description.en],
    })
    problemReport.addLocale('en')
    return problemReport
  }

  @IsValidMessageType(DidCommProblemReportV2Message.type)
  public readonly type = DidCommProblemReportV2Message.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/report-problem/2.0/problem-report')

  @IsOptional()
  @IsString({ each: true })
  public ack?: string[]

  @IsString()
  public code!: string

  @IsOptional()
  @IsString()
  public comment?: string

  @IsOptional()
  @IsArray()
  public args?: unknown[]

  @IsOptional()
  @IsString()
  @Expose({ name: 'escalate_to' })
  public escalateTo?: string

  public toV2Plaintext(): DidCommV2PlaintextMessage {
    const body: Record<string, unknown> = { code: this.code }
    if (this.comment !== undefined) body.comment = this.comment
    if (this.args !== undefined) body.args = this.args
    if (this.escalateTo !== undefined) body.escalate_to = this.escalateTo
    const v2: DidCommV2PlaintextMessage = {
      id: this.id,
      type: DidCommProblemReportV2Message.type.messageTypeUri,
      body,
    }
    if (this.ack !== undefined) v2.ack = this.ack
    const lang = this.getLocale()
    if (lang !== undefined) v2.lang = lang
    if (this.transport?.returnRoute !== undefined) v2.return_route = this.transport.returnRoute
    return v2
  }
}
