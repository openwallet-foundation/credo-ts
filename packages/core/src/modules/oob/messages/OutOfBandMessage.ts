import type { PlaintextMessage } from '../../../types'
import type { DidCommService } from '../../connections/models/did/service/DidCommService'

import { Expose, Type } from 'class-transformer'
import { ArrayNotEmpty, Equals, IsArray, IsInstance, IsOptional, ValidateNested } from 'class-validator'
import { parseUrl } from 'query-string'

import { AgentMessage } from '../../../agent/AgentMessage'
import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { AriesFrameworkError } from '../../../error'
import { JsonEncoder } from '../../../utils/JsonEncoder'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { MessageValidator } from '../../../utils/MessageValidator'

interface OutOfBandMessageOptions {
  id?: string
  label?: string
  goalCode?: string
  goal?: string
  accept?: string[]
  handshakeProtocols?: string[]
  services: Array<DidCommService | string>
}

export class OutOfBandMessage extends AgentMessage {
  public constructor(options: OutOfBandMessageOptions) {
    super()
    if (options) {
      this.id = options.id ?? this.generateId()
      this.label = options.label
      this.goalCode = options.goalCode
      this.goal = options.goal
      this.accept = options.accept
      this.handshakeProtocols = options.handshakeProtocols
      this.services = options.services
    }
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

  public getRequests(): PlaintextMessage[] | undefined {
    return this.requests?.map((request) => request.getDataAsJson())
  }

  public toUrl({ domain }: { domain: string }) {
    const invitationJson = this.toJSON()
    const encodedInvitation = JsonEncoder.toBase64URL(invitationJson)
    const invitationUrl = `${domain}?oob=${encodedInvitation}`
    return invitationUrl
  }

  public static async fromUrl(invitationUrl: string) {
    const parsedUrl = parseUrl(invitationUrl).query
    const encodedInvitation = parsedUrl['oob']

    if (typeof encodedInvitation === 'string') {
      const invitationJson = JsonEncoder.fromBase64(encodedInvitation)
      const invitation = this.fromJson(invitationJson)

      return invitation
    } else {
      throw new AriesFrameworkError(
        'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters; `oob`'
      )
    }
  }

  public static async fromJson(json: Record<string, unknown>) {
    const invitation = JsonTransformer.fromJSON(json, OutOfBandMessage)
    await MessageValidator.validate(invitation)
    return invitation
  }

  @Equals(OutOfBandMessage.type)
  public readonly type = OutOfBandMessage.type
  public static readonly type = `https://didcomm.org/out-of-band/1.1/invitation`

  public readonly label?: string

  @Expose({ name: 'goal_code' })
  public readonly goalCode?: string

  public readonly goal?: string

  public readonly accept?: string[]

  @Expose({ name: 'handshake_protocols' })
  public handshakeProtocols?: string[]

  @Expose({ name: 'requests~attach' })
  @Type(() => Attachment)
  @IsArray()
  @ValidateNested({
    each: true,
  })
  @IsInstance(Attachment, { each: true })
  @IsOptional()
  private requests?: Attachment[]

  @IsArray()
  @ArrayNotEmpty()
  public services: Array<DidCommService | string> = []
}
