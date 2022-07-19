import type { DIDCommV2MessageParams } from '../../../agent/didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, IsOptional, IsString, ValidateNested } from 'class-validator'
import { parseUrl } from 'query-string'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { AriesFrameworkError } from '../../../error'
import { JsonEncoder, JsonTransformer } from '../../../utils'

export enum OutOfBandGoalCode {
  DidExchange = 'did-exchange',
  MediatorProvision = 'mediator-provision',
}

export type OutOfBandInvitationParams = DIDCommV2MessageParams

export class OutOfBandInvitationBody {
  @IsString()
  @Expose({ name: 'goal_code' })
  public goalCode!: OutOfBandGoalCode

  @IsString()
  @IsOptional()
  public goal?: string
}

export class OutOfBandInvitationMessage extends DIDCommV2Message {
  public constructor(options?: OutOfBandInvitationParams) {
    super(options)
  }

  @IsString()
  public from!: string

  @Type(() => OutOfBandInvitationBody)
  @ValidateNested()
  @IsInstance(OutOfBandInvitationBody)
  public body!: OutOfBandInvitationBody

  @Equals(OutOfBandInvitationMessage.type)
  public readonly type = OutOfBandInvitationMessage.type
  public static readonly type = 'https://didcomm.org/out-of-band/2.0/invitation'

  public toUrl({ domain }: { domain: string }) {
    const encodedInvitation = JsonEncoder.toBase64URL(this.toJSON())
    return `${domain}?oob=${encodedInvitation}`
  }

  public static fromUrl(invitationUrl: string) {
    const parsedUrl = parseUrl(invitationUrl).query
    const encodedInvitation = parsedUrl['oob']

    if (typeof encodedInvitation === 'string') {
      const invitationJson = JsonEncoder.fromBase64(encodedInvitation)
      return this.fromJson(invitationJson)
    } else {
      throw new AriesFrameworkError(
        'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters; `oob`'
      )
    }
  }

  public static fromJson(json: Record<string, unknown>) {
    return JsonTransformer.fromJSON(json, OutOfBandInvitationMessage)
  }
}
