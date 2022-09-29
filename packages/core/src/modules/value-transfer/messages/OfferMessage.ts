import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Offer } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Equals } from 'class-validator'

import { JsonTransformer } from '../../../utils'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class OfferMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(OfferMessage.type)
  public readonly type = OfferMessage.type
  public static readonly type = Offer.type

  public toLink({ domain }: { domain: string }) {
    return this.toUrl({ domain })
  }

  public static fromLink({ url }: { url: string }) {
    const message = this.fromUrl({ url })
    return OfferMessage.fromJson(message)
  }

  public static fromJson(json: Record<string, unknown>) {
    return JsonTransformer.fromJSON(json, OfferMessage)
  }
}
