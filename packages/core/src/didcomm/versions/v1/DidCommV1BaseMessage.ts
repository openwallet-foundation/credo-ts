import type { ParsedMessageType } from '../../../utils/messageType'
import type { Constructor } from '../../../utils/mixins'

import { Expose } from 'class-transformer'
import { Matches } from 'class-validator'

import { uuid } from '../../../utils/uuid'
import { MessageIdRegExp, MessageTypeRegExp } from '../../validation'

export type DidComV1BaseMessageConstructor = Constructor<DidCommV1BaseMessage>

export class DidCommV1BaseMessage {
  @Matches(MessageIdRegExp)
  @Expose({ name: '@id' })
  public id!: string

  @Expose({ name: '@type' })
  @Matches(MessageTypeRegExp)
  public readonly type!: string
  public static readonly type: ParsedMessageType

  public generateId() {
    return uuid()
  }
}
