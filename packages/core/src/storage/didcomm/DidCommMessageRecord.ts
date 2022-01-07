import type { AgentMessage } from '../../agent/AgentMessage'
import type { JsonMap } from '../../types'
import type { DidCommMessageRole } from './DidCommMessageRole'

import { AriesFrameworkError } from '../../error'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { rightSplit } from '../../utils/string'
import { uuid } from '../../utils/uuid'
import { BaseRecord } from '../BaseRecord'

export type DefaultDidCommMessageTags = {
  role: DidCommMessageRole
  connectionId?: string

  // Computed
  protocolName: string
  messageName: string
  versionMajor: string
  versionMinor: string
  messageType: string
  messageId: string
  threadId: string
}

export interface DidCommMessageRecordProps {
  role: DidCommMessageRole
  message: JsonMap
  id?: string
  createdAt?: Date
  connectionId?: string
}

export class DidCommMessageRecord extends BaseRecord<DefaultDidCommMessageTags> {
  public message!: JsonMap
  public role!: DidCommMessageRole
  public connectionId?: string

  public static readonly type = 'DidCommMessageRecord'
  public readonly type = DidCommMessageRecord.type

  public constructor(props: DidCommMessageRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.connectionId = props.connectionId
      this.role = props.role
      this.message = props.message
    }
  }

  public getTags() {
    const messageId = this.message['@id'] as string
    const messageType = this.message['@type'] as string
    const [, protocolName, protocolVersion, messageName] = rightSplit(messageType, '/', 3)
    const [versionMajor, versionMinor] = protocolVersion.split('.')

    const thread = this.message['~thread']
    let threadId = messageId

    // FIXME: make this less verbose
    if (
      thread &&
      typeof thread === 'object' &&
      thread !== null &&
      !Array.isArray(thread) &&
      typeof thread.thid === 'string'
    ) {
      threadId = thread.thid
    }

    return {
      ...this._tags,
      role: this.role,
      connectionId: this.connectionId,

      // Computed properties based on message id and type
      threadId,
      protocolName,
      messageName,
      versionMajor,
      versionMinor,
      messageType,
      messageId,
    }
  }

  public getMessageInstance<MessageClass extends typeof AgentMessage = typeof AgentMessage>(
    messageClass: MessageClass
  ): InstanceType<MessageClass> {
    if (messageClass.type !== this.message['@type']) {
      throw new AriesFrameworkError('Provided message class type does not match type of stored message')
    }

    return JsonTransformer.fromJSON(this.message, messageClass) as InstanceType<MessageClass>
  }
}
