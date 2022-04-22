import type { Constructor } from '../../../utils/mixins'

import { Expose } from 'class-transformer'
import { Matches } from 'class-validator'

import { uuid } from '../../../utils/uuid'
import { MessageIdRegExp, MessageTypeRegExp } from '../validation'

export type DIDComV1BaseMessageConstructor = Constructor<DIDCommV1BaseMessage>

export class DIDCommV1BaseMessage {
  @Matches(MessageIdRegExp)
  @Expose({ name: '@id' })
  public id!: string

  @Expose({ name: '@type' })
  @Matches(MessageTypeRegExp)
  public readonly type!: string
  public static readonly type: string

  public generateId() {
    return uuid()
  }
}
