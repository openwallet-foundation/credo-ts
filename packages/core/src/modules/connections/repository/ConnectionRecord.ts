import type { TagsBase } from '../../../storage/BaseRecord'
import type { ConnectionRole } from '../models/ConnectionRole'

import { Type } from 'class-transformer'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { ConnectionInvitationMessage } from '../messages/ConnectionInvitationMessage'
import { ConnectionState } from '../models/ConnectionState'
import { DidDoc } from '../models/did/DidDoc'

export interface ConnectionRecordProps {
  id?: string
  createdAt?: Date
  did: string
  didDoc: DidDoc
  verkey: string
  theirDid?: string
  theirDidDoc?: DidDoc
  theirLabel?: string
  invitation?: ConnectionInvitationMessage
  state: ConnectionState
  role: ConnectionRole
  alias?: string
  autoAcceptConnection?: boolean
  threadId?: string
  tags?: CustomConnectionTags
  multiUseInvitation: boolean
}

export type CustomConnectionTags = TagsBase
export type DefaultConnectionTags = {
  state: ConnectionState
  role: ConnectionRole
  invitationKey?: string
  threadId?: string
  verkey?: string
  theirKey?: string
}

export class ConnectionRecord
  extends BaseRecord<DefaultConnectionTags, CustomConnectionTags>
  implements ConnectionRecordProps
{
  public state!: ConnectionState
  public role!: ConnectionRole

  @Type(() => DidDoc)
  public didDoc!: DidDoc
  public did!: string
  public verkey!: string

  @Type(() => DidDoc)
  public theirDidDoc?: DidDoc
  public theirDid?: string
  public theirLabel?: string

  @Type(() => ConnectionInvitationMessage)
  public invitation?: ConnectionInvitationMessage
  public alias?: string
  public autoAcceptConnection?: boolean
  public multiUseInvitation!: boolean

  public threadId?: string

  public static readonly type = 'ConnectionRecord'
  public readonly type = ConnectionRecord.type

  public constructor(props: ConnectionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.did = props.did
      this.didDoc = props.didDoc
      this.verkey = props.verkey
      this.theirDid = props.theirDid
      this.theirDidDoc = props.theirDidDoc
      this.theirLabel = props.theirLabel
      this.state = props.state
      this.role = props.role
      this.alias = props.alias
      this.autoAcceptConnection = props.autoAcceptConnection
      this._tags = props.tags ?? {}
      this.invitation = props.invitation
      this.threadId = props.threadId
      this.multiUseInvitation = props.multiUseInvitation
    }
  }

  public getTags() {
    const invitationKey = (this.invitation?.recipientKeys && this.invitation.recipientKeys[0]) || undefined

    return {
      ...this._tags,
      state: this.state,
      role: this.role,
      invitationKey,
      threadId: this.threadId,
      verkey: this.verkey,
      theirKey: this.theirKey || undefined,
    }
  }

  public get myKey() {
    const [service] = this.didDoc?.didCommServices ?? []

    if (!service) {
      return null
    }

    return service.recipientKeys[0]
  }

  public get theirKey() {
    const [service] = this.theirDidDoc?.didCommServices ?? []

    if (!service) {
      return null
    }

    return service.recipientKeys[0]
  }

  public get isReady() {
    return [ConnectionState.Responded, ConnectionState.Complete].includes(this.state)
  }

  public assertReady() {
    if (!this.isReady) {
      throw new AriesFrameworkError(
        `Connection record is not ready to be used. Expected ${ConnectionState.Responded} or ${ConnectionState.Complete}, found invalid state ${this.state}`
      )
    }
  }

  public assertState(expectedStates: ConnectionState | ConnectionState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new AriesFrameworkError(
        `Connection record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertRole(expectedRole: ConnectionRole) {
    if (this.role !== expectedRole) {
      throw new AriesFrameworkError(`Connection record has invalid role ${this.role}. Expected role ${expectedRole}.`)
    }
  }
}
