import type { DIDCommV2MessageParams } from '../../../agent/didcomm'
import type { Attachment } from 'didcomm'

import { Expose, Type } from 'class-transformer'
import { Equals, IsInstance, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'

import { DIDCommV2Message } from '../../../agent/didcomm'
import { JsonTransformer } from '../../../utils'

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
  @IsString()
  public getter?: string

  @IsNumber()
  public amount!: number
}

export const ANDROID_NEARBY_HANDSHAKE_ATTACHMENT_ID = 'android-nearby-handshake-attachment'
export const PAYMENT_OFFER_ATTACHMENT_ID = 'payment-offer-attachment'
export const ATTACHMENT_ID = 'oob-attachment'
const LINK_PARAM = 'oob'

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

  public toLink({ domain }: { domain: string }) {
    return this.toUrl({ domain, param: LINK_PARAM })
  }

  public static fromLink({ url }: { url: string }) {
    const message = this.fromUrl({ url, param: LINK_PARAM })
    return JsonTransformer.fromJSON(message, OutOfBandInvitationMessage)
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

  public get getAndroidNearbyHandshakeAttachment(): AndroidNearbyHandshakeAttachment | null {
    const attachment = this.getOutOfBandAttachment(ANDROID_NEARBY_HANDSHAKE_ATTACHMENT_ID)
    if (!attachment) return null
    return JsonTransformer.fromJSON(attachment, AndroidNearbyHandshakeAttachment)
  }

  public get getPaymentOfferAttachment(): PaymentOfferAttachment | null {
    const attachment = this.getOutOfBandAttachment(PAYMENT_OFFER_ATTACHMENT_ID)
    if (!attachment) return null
    return JsonTransformer.fromJSON(attachment, PaymentOfferAttachment)
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
