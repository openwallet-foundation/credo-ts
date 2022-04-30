import type { TagsBase } from '../../../storage/BaseRecord'
import type { HandshakeProtocol } from '../models'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { ConnectionRole, DidExchangeRole, ConnectionState, DidExchangeState } from '../models'

export interface ConnectionRecordProps {
  id?: string
  createdAt?: Date
  did: string
  theirDid?: string
  theirLabel?: string
  state?: ConnectionState | DidExchangeState
  role?: ConnectionRole | DidExchangeRole
  alias?: string
  autoAcceptConnection?: boolean
  threadId?: string
  tags?: CustomConnectionTags
  imageUrl?: string
  multiUseInvitation?: boolean
  mediatorId?: string
  errorMessage?: string
  protocol?: HandshakeProtocol
  outOfBandId?: string
  invitationDid?: string
}

export type CustomConnectionTags = TagsBase
export type DefaultConnectionTags = {
  state?: ConnectionState | DidExchangeState
  role?: ConnectionRole | DidExchangeRole
  threadId?: string
  mediatorId?: string
  did: string
  theirDid?: string
  outOfBandId?: string
  invitationDid?: string
}

export class ConnectionRecord
  extends BaseRecord<DefaultConnectionTags, CustomConnectionTags>
  implements ConnectionRecordProps
{
  public state?: ConnectionState | DidExchangeState
  public role?: ConnectionRole | DidExchangeRole

  public did!: string

  public theirDid?: string
  public theirLabel?: string

  public alias?: string
  public autoAcceptConnection?: boolean
  public imageUrl?: string
  public multiUseInvitation!: boolean

  public threadId?: string
  public mediatorId?: string
  public errorMessage?: string
  public protocol?: HandshakeProtocol
  public outOfBandId?: string
  public invitationDid?: string

  public static readonly type = 'ConnectionRecord'
  public readonly type = ConnectionRecord.type

  public constructor(props: ConnectionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.did = props.did
      this.invitationDid = props.invitationDid
      this.theirDid = props.theirDid
      this.theirLabel = props.theirLabel
      this.state = props.state
      this.role = props.role
      this.alias = props.alias
      this.autoAcceptConnection = props.autoAcceptConnection
      this._tags = props.tags ?? {}
      this.threadId = props.threadId
      this.imageUrl = props.imageUrl
      this.multiUseInvitation = props.multiUseInvitation || false
      this.mediatorId = props.mediatorId
      this.errorMessage = props.errorMessage
      this.protocol = props.protocol
      this.outOfBandId = props.outOfBandId
    }
  }

  public getTags() {
    return {
      ...this._tags,
      state: this.state,
      role: this.role,
      threadId: this.threadId,
      mediatorId: this.mediatorId,
      did: this.did,
      theirDid: this.theirDid,
      outOfBandId: this.outOfBandId,
      invitationDid: this.invitationDid,
    }
  }

  public get isRequester() {
    return this.role === ConnectionRole.Invitee || this.role === DidExchangeRole.Requester
  }

  public get isReady() {
    return (
      this.state &&
      [
        ConnectionState.Responded,
        ConnectionState.Complete,
        DidExchangeState.Completed,
        DidExchangeState.ResponseSent,
      ].includes(this.state)
    )
  }

  public assertReady() {
    if (!this.isReady) {
      throw new AriesFrameworkError(
        `Connection record is not ready to be used. Expected ${ConnectionState.Responded} or ${ConnectionState.Complete}, found invalid state ${this.state}`
      )
    }
  }

  public assertState(expectedStates: ConnectionState | DidExchangeState | (ConnectionState | DidExchangeState)[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (this.state && !expectedStates.includes(this.state)) {
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
