import type { DidCommV2MessageParams } from '../../../../../didcomm/versions/v2'

import { Expose, Type } from 'class-transformer'
import { IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'
import { parseUrl } from 'query-string'

import { DidCommV2Message } from '../../../../../didcomm'
import { AriesFrameworkError } from '../../../../../error/AriesFrameworkError'
import { JsonEncoder, JsonTransformer } from '../../../../../utils'
import { IsValidMessageType, parseMessageType } from '../../../../../utils/messageType'

export enum V2OutOfBandGoalCode {
  DidExchange = 'did-exchange',
}

const LINK_PARAM = 'oob'

export type V2OutOfBandInvitationParams = DidCommV2MessageParams

export class V2OutOfBandInvitationBody {
  @IsString()
  @IsOptional()
  @Expose({ name: 'goal_code' })
  public goalCode?: V2OutOfBandGoalCode

  @IsString()
  @IsOptional()
  public goal?: string
}

export class V2OutOfBandInvitation extends DidCommV2Message {
  public constructor(options?: V2OutOfBandInvitationParams) {
    super(options)
  }

  @IsString()
  public from!: string

  @Type(() => V2OutOfBandInvitationBody)
  @ValidateNested()
  @IsInstance(V2OutOfBandInvitationBody)
  public body!: V2OutOfBandInvitationBody

  @IsValidMessageType(V2OutOfBandInvitation.type)
  public readonly type: string = V2OutOfBandInvitation.type.messageTypeUri
  public static readonly type = parseMessageType('https://didcomm.org/out-of-band/2.0/invitation')

  public static fromJson(json: Record<string, unknown>) {
    return JsonTransformer.fromJSON(json, V2OutOfBandInvitation)
  }

  public getOutOfBandAttachment(id?: string): Record<string, unknown> | null {
    if (!this.attachments?.length) {
      return null
    }
    const attachmentId = id || this.attachments[0].id
    const attachment = this.getAttachmentDataAsJson(attachmentId)
    if (!attachment) return null
    return typeof attachment === 'string' ? JSON.parse(attachment) : attachment
  }

  public toUrl({ domain }: { domain: string }) {
    const invitationJson = this.toJSON()
    const encodedInvitation = JsonEncoder.toBase64URL(invitationJson)
    const invitationUrl = `${domain}?${LINK_PARAM}=${encodedInvitation}`
    return invitationUrl
  }

  public static fromUrl(invitationUrl: string) {
    const parsedUrl = parseUrl(invitationUrl).query
    const encodedInvitation = parsedUrl[LINK_PARAM]
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
}
