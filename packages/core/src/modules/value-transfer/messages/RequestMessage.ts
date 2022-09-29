import type { ValueTransferMessageParams } from './ValueTransferBaseMessage'

import { Request } from '@sicpa-dlab/value-transfer-protocol-ts'
import { Equals } from 'class-validator'

import { JsonTransformer } from '../../../utils'

import { ValueTransferBaseMessage } from './ValueTransferBaseMessage'

export class RequestMessage extends ValueTransferBaseMessage {
  public constructor(options?: ValueTransferMessageParams) {
    super(options)
  }

  @Equals(RequestMessage.type)
  public readonly type = RequestMessage.type
  public static readonly type = Request.type

  public toLink({ domain }: { domain: string }) {
    return this.toUrl({ domain })
  }

  public static fromLink({ url }: { url: string }) {
    const message = this.fromUrl({ url })
    return RequestMessage.fromJson(message)
  }

  public static fromJson(json: Record<string, unknown>) {
    return JsonTransformer.fromJSON(json, RequestMessage)
  }
}
