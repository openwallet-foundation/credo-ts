import type { TagsBase } from '../../../storage/BaseRecord'
import type { HandshakeProtocol } from '../models'

import { Type } from 'class-transformer'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { ConnectionRole, DidExchangeRole, DidDoc, ConnectionState, DidExchangeState } from '../models'

export interface ConnectionRecordProps {
  id?: string
  createdAt?: Date
  did: string
  didDoc: DidDoc
  verkey: string
  theirDid?: string
  theirDidDoc?: DidDoc
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
}

export type CustomConnectionTags = TagsBase
export type DefaultConnectionTags = {
  state?: ConnectionState | DidExchangeState
  role?: ConnectionRole | DidExchangeRole
  threadId?: string
  verkey?: string
  theirKey?: string
  mediatorId?: string
  did: string
  theirDid?: string
  outOfBandId?: string
}

export class ConnectionRecord
  extends BaseRecord<DefaultConnectionTags, CustomConnectionTags>
  implements ConnectionRecordProps
{
  public state?: ConnectionState | DidExchangeState
  public role?: ConnectionRole | DidExchangeRole

  @Type(() => DidDoc)
  public didDoc!: DidDoc
  public did!: string
  public verkey!: string

  @Type(() => DidDoc)
  public theirDidDoc?: DidDoc
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
      verkey: this.verkey,
      theirKey: this.theirKey || undefined,
      mediatorId: this.mediatorId,
      did: this.did,
      theirDid: this.theirDid,
      outOfBandId: this.outOfBandId,
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
