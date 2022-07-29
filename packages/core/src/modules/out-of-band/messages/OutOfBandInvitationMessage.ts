import type { DIDCommV2MessageParams } from '../../../agent/didcomm'
import type { Attachment } from 'didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { parseUrl } from 'query-string'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { AriesFrameworkError } from '../../../error'
import { JsonEncoder, JsonTransformer } from '../../../utils'

export enum OutOfBandGoalCode {
  DidExchange = 'did-exchange',
  MediatorProvision = 'mediator-provision',
  AndroidNearbyHandshake = 'android-nearby-handshake',
  PaymentOffer = 'payment-offer',
}

export class AndroidNearbyHandshakeAttachment {
  @IsString()
  public nearbyTagIdentifier!: string
}

export class PaymentOfferAttachment {
  @IsNumber()
  public amount!: number
}

export const ANDROID_NEARBY_HANDSHAKE_ATTACHMENT_ID = 'android-nearby-handshake-attachment'
export const PAYMENT_OFFER_ATTACHMENT_ID = 'payment-offer-attachment'
export const ATTACHMENT_ID = 'oob-attachment'

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

  public static createAndroidNearbyHandshakeJSONAttachment(attachment: AndroidNearbyHandshakeAttachment): Attachment {
    return this.createJSONAttachment(ANDROID_NEARBY_HANDSHAKE_ATTACHMENT_ID, JsonTransformer.toJSON(attachment))
  }

  public static createPaymentOfferJSONAttachment(attachment: PaymentOfferAttachment): Attachment {
    return this.createJSONAttachment(PAYMENT_OFFER_ATTACHMENT_ID, JsonTransformer.toJSON(attachment))
  }

  public static createOutOfBandJSONAttachment(attachment: Record<string, unknown>): Attachment {
    return this.createJSONAttachment(ATTACHMENT_ID, JsonTransformer.toJSON(attachment))
  }

  public get getAndroidNearbyHandshakeAttachment(): Record<string, unknown> | null {
    return this.getOutOfBandAttachment(ANDROID_NEARBY_HANDSHAKE_ATTACHMENT_ID)
  }

  public get getPaymentOfferAttachment(): Record<string, unknown> | null {
    return this.getOutOfBandAttachment(PAYMENT_OFFER_ATTACHMENT_ID)
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
}
