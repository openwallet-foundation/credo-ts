import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Equals } from 'class-validator'

import { JsonTransformer } from '../../../utils'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class RequestMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(RequestMessage.type)
  public readonly type = RequestMessage.type
  public static readonly type = 'https://didcomm.org/vtp/1.0/step-1'

  public toLink({ domain }: { domain: string }) {
    return this.toUrl({ domain })
  }

  public static fromLink({ url }: { url: string }) {
    const message = this.fromUrl({ url })
    return JsonTransformer.fromJSON(message, RequestMessage)
  }
}
