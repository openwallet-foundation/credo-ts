import type { ServiceDecorator } from '../../../decorators/service/ServiceDecorator'
import type { DIDCommMessage } from '../DIDCommMessage'

import { parseUrl } from 'query-string'

import { AriesFrameworkError } from '../../../error'
import { JsonEncoder } from '../../../utils'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { DIDCommVersion } from '../DIDCommMessage'

import { DIDCommV2BaseMessage } from './DIDCommV2BaseMessage'

export class DIDCommV2Message extends DIDCommV2BaseMessage implements DIDCommMessage {
  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }

  public get version(): DIDCommVersion {
    return DIDCommVersion.V2
  }

  public get threadId(): string | undefined {
    return this.thid
  }

  public get sender(): string | undefined {
    return this.from
  }

  public serviceDecorator(): ServiceDecorator | undefined {
    return undefined
  }

  public hasAnyReturnRoute() {
    return false
  }

  public hasReturnRouting() {
    return false
  }

  public setReturnRouting(): void {
    return
  }

  public setThread(options: { threadId: string | undefined }) {
    this.thid = options.threadId
  }

  public is<C extends typeof DIDCommV2Message>(Class: C): this is InstanceType<C> {
    return this.type === Class.type
  }

  public setRecipient(to?: string) {
    this.to = to ? [to] : undefined
  }

  public toUrl({ domain, param }: { domain: string; param?: string }) {
    const queryParam = param || 'dm'
    const encodedMessage = JsonEncoder.toBase64URL(this.toJSON())
    return `${domain}?${queryParam}=${encodedMessage}`
  }

  public static fromUrl({ url, param }: { url: string; param?: string }) {
    const parsedUrl = parseUrl(url).query
    const encoded = param ? parsedUrl[param] : parsedUrl['dm'] || parsedUrl['oob']

    if (typeof encoded === 'string') {
      return JsonEncoder.fromBase64(encoded)
    } else {
      throw new AriesFrameworkError(
        'MessageUrl is invalid. It needs to contain one, and only one, of the following parameters; `dm`'
      )
    }
  }

  public toLink({ domain }: { domain: string }) {
    return this.toUrl({ domain })
  }

  public static fromLink({ url }: { url: string }) {
    const message = this.fromUrl({ url })
    return JsonTransformer.fromJSON(message, DIDCommV2Message)
  }
}
