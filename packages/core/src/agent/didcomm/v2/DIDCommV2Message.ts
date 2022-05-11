import type { ServiceDecorator } from '../../../decorators/service/ServiceDecorator'
import type { DIDCommMessage } from '../DIDCommMessage'

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
}
