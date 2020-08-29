import { Compose } from '../utils/mixins';
import { ThreadDecorated } from '../decorators/thread/ThreadDecoratorExtension';
import { L10nDecorated } from '../decorators/l10n/L10nDecoratorExtension';
import { TransportDecorated } from '../decorators/transport/TransportDecoratorExtension';
import { TimingDecorated } from '../decorators/timing/TimingDecoratorExtension';
import { MessageTransformer } from './MessageTransformer';
import { BaseMessage } from './BaseMessage';

const DefaultDecorators = [ThreadDecorated, L10nDecorated, TransportDecorated, TimingDecorated];

export class AgentMessage extends Compose(BaseMessage, DefaultDecorators) {
  public toJSON(): Record<string, unknown> {
    return MessageTransformer.toJSON(this);
  }

  public is<C extends typeof AgentMessage>(Class: C): this is InstanceType<C> {
    return this.type === Class.type;
  }
}
