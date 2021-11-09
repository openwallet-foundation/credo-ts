import type { UnpackedMessage } from '../../types'
import type { DidCommService } from '../connections/models/did/service/DidCommService'

import { Expose, Type } from 'class-transformer'
import { Equals, IsArray, IsInstance, ValidateNested } from 'class-validator'

import { AgentMessage } from '../../agent/AgentMessage'
import { Attachment, AttachmentData } from '../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../utils/JsonEncoder'

export interface OutOfBandMessageOptions {
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

  public addHandshakeProtocol(protocol: string) {
    if (!this.handshakeProtocols) this.handshakeProtocols = []
    this.handshakeProtocols.push(protocol)
  }

  public addRequest(message: AgentMessage) {
    if (!this.requests) this.requests = []
    const requestAttachment = new Attachment({
      id: this.generateId(),
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: JsonEncoder.toBase64(message.toJSON()),
      }),
    })
    this.requests.push(requestAttachment)
  }

  public getRequests(): UnpackedMessage[] | undefined {
    return this.requests?.map((request) => {
      if (request.data.base64) {
        return JsonEncoder.fromBase64(request.data.base64)
      } else {
        throw new Error('There is no base64 encoded data in attachment')
      }
    })
  }

  public addService(service: DidCommService) {
    this.services.push(service)
  }

  @Equals(OutOfBandMessage.type)
  public readonly type = OutOfBandMessage.type
  public static readonly type = `https://didcomm.org/out-of-band/1.1/invitation`

  public readonly label?: string

  @Expose({ name: 'goal_code' })
  public readonly goalCode?: string

  public readonly goal?: string

  // TODO what type is it, is there any enum or should we create a new one
  public readonly accept: string[] = []

  // TODO what type is it, should we create an enum
  @Expose({ name: 'handshake_protocols' })
  public handshakeProtocols?: string[]

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  private requests?: Attachment[]

  public readonly services: DidCommService[] = []
}
