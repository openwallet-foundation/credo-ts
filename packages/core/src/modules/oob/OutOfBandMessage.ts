import type { UnpackedMessage, UnpackedMessageContext } from '../../types'
import type { DidCommService } from '../connections/models/did/service/DidCommService'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../agent/AgentMessage'
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../utils/JsonEncoder'

const VERSION = '1.1'

interface OutOfBandMessageOptions {
  id?: string
  label?: string
  goalCode?: string
  goal?: string
}

export class OutOfBandMessage extends AgentMessage {
  public constructor(options: OutOfBandMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.label = options.label
      this.goalCode = options.goalCode
      this.goal = options.goal
    }
  }

  public addRequest(message: AgentMessage) {
    const requestAttachment = new Attachment({
      id: 'request-0',
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(message.toJSON()),
      }),
    })
    this.requests.push(requestAttachment)
  }

  public getRequests(): UnpackedMessage[] {
    return this.requests.map((request) => {
      if (request.data.base64) {
        return JsonEncoder.fromBase64(request.data.base64)
      } else {
        throw new Error('There is no base64 encoded data in attachment')
      }
    })
  }

  @Equals(OutOfBandMessage.type)
  public readonly type = OutOfBandMessage.type
  public static readonly type = `https://didcomm.org/out-of-band/${VERSION}/invitation`

  public readonly label?: string

  @Expose({ name: 'goal_code' })
  public readonly goalCode?: string

  public readonly goal?: string

  // TODO what type is it, is there any enum or should we create a new one
  public readonly accept: string[] = []

  // TODO what type is it, should we create an enum
  @Expose({ name: 'handshake_protocols' })
  public readonly handshakeProtocols: string[] = []

  public readonly services: DidCommService[] = []

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  private readonly requests: Attachment[] = []
}
