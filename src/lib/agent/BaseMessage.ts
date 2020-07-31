import { Expose } from 'class-transformer';
import { Matches } from 'class-validator';
import { v4 as uuid } from 'uuid';

import { Constructor } from '../utils/mixins';

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
}
