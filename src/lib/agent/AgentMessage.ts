import { Expose } from 'class-transformer';
import { Matches } from 'class-validator';
import uuid from 'uuid/v4';

import { Constructor, Compose } from '../utils/mixins';
import { ThreadDecorated } from '../decorators/thread/ThreadDecoratorExtension';
import { L10nDecorated } from '../decorators/l10n/L10nDecoratorExtension';
import { TransportDecorated } from '../decorators/transport/TransportDecoratorExtension';
import { TimingDecorated } from '../decorators/timing/TimingDecoratorExtension';
import { MessageTransformer } from './MessageTransformer';

export const MessageIdRegExp = /[-_./a-zA-Z0-9]{8,64}/;
export const MessageTypeRegExp = /(.*?)([a-z0-9._-]+)\/(\d[^/]*)\/([a-z0-9._-]+)$/;

export type BaseMessageConstructor = Constructor<BaseMessage>;

export class BaseMessage {
  @Matches(MessageIdRegExp)
  @Expose({ name: '@id' })
  id!: string;

  @Expose({ name: '@type' })
  @Matches(MessageTypeRegExp)
  readonly type!: string;
  static readonly type: string;

  generateId() {
    return uuid();
  }

  is<C extends typeof BaseMessage>(Class: C): this is InstanceType<C> {
    return this.type === Class.type;
  }
}

const DefaultDecorators = [ThreadDecorated, L10nDecorated, TransportDecorated, TimingDecorated];

export class AgentMessage extends Compose(BaseMessage, DefaultDecorators) {
  toJSON(): object {
    return MessageTransformer.toJSON(this);
  }
}
