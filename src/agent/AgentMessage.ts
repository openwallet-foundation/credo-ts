import { Compose } from '../utils/mixins'
import { ThreadDecorated } from '../decorators/thread/ThreadDecoratorExtension'
import { L10nDecorated } from '../decorators/l10n/L10nDecoratorExtension'
import { TransportDecorated } from '../decorators/transport/TransportDecoratorExtension'
import { TimingDecorated } from '../decorators/timing/TimingDecoratorExtension'
import { BaseMessage } from './BaseMessage'
import { JsonTransformer } from '../utils/JsonTransformer'
import { AckDecorated } from '../decorators/ack/AckDecoratorExtension'
import { AttachmentDecorated } from '../decorators/attachment/AttachmentExtension'

const DefaultDecorators = [
  ThreadDecorated,
  L10nDecorated,
  TransportDecorated,
  TimingDecorated,
  AckDecorated,
  AttachmentDecorated,
]

export class AgentMessage extends Compose(BaseMessage, DefaultDecorators) {
  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }

  public is<C extends typeof AgentMessage>(Class: C): this is InstanceType<C> {
    return this.type === Class.type
  }
}
