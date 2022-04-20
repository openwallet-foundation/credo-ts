import type { AgentMessage } from '../../agent/AgentMessage'
import type { JsonObject } from '../../types'
import type { DidCommMessageRole } from './DidCommMessageRole'

import { AriesFrameworkError } from '../../error'
import { JsonTransformer } from '../../utils/JsonTransformer'
import { parseMessageType } from '../../utils/messageType'
import { isJsonObject } from '../../utils/type'
import { uuid } from '../../utils/uuid'
import { BaseRecord } from '../BaseRecord'

export type DefaultDidCommMessageTags = {
  role: DidCommMessageRole
  associatedRecordId?: string

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
  message: JsonObject
  id?: string
  createdAt?: Date
  associatedRecordId?: string
}

export class DidCommMessageRecord extends BaseRecord<DefaultDidCommMessageTags> {
  public message!: JsonObject
  public role!: DidCommMessageRole

  /**
   * The id of the record that is associated with this message record.
   *
   * E.g. if the connection record wants to store an invitation message
   * the associatedRecordId will be the id of the connection record.
   */
  public associatedRecordId?: string

  public static readonly type = 'DidCommMessageRecord'
  public readonly type = DidCommMessageRecord.type

  public constructor(props: DidCommMessageRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.associatedRecordId = props.associatedRecordId
      this.role = props.role
      this.message = props.message
    }
  }

  public getTags() {
    const messageId = this.message['@id'] as string
    const messageType = this.message['@type'] as string

    const { protocolName, protocolVersion, messageName } = parseMessageType(messageType)
    const [versionMajor, versionMinor] = protocolVersion.split('.')

    const thread = this.message['~thread']
    let threadId = messageId

    if (isJsonObject(thread) && typeof thread.thid === 'string') {
      threadId = thread.thid
    }

    return {
      ...this._tags,
      role: this.role,
      associatedRecordId: this.associatedRecordId,

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
