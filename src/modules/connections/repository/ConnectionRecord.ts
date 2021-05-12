import { Type } from 'class-transformer'
import { uuid } from '../../../utils/uuid'
import { BaseRecord, Tags } from '../../../storage/BaseRecord'
import { ConnectionState } from '..'
import { ConnectionInvitationMessage } from '..'
import { ConnectionRole } from '..'
import { DidDoc } from '..'
import type { Did, Verkey } from 'indy-sdk'

interface ConnectionProps {
  id?: string
  createdAt?: Date
  did: Did
  didDoc: DidDoc
  verkey: Verkey
  theirDid?: Did
  theirDidDoc?: DidDoc
  invitation?: ConnectionInvitationMessage
  state: ConnectionState
  role: ConnectionRole
  alias?: string
  autoAcceptConnection?: boolean
}

export interface ConnectionTags extends Tags {
  invitationKey?: string
  threadId?: string
  verkey?: string
  theirKey?: string
}

export interface ConnectionStorageProps extends ConnectionProps {
  tags: ConnectionTags
}

export class ConnectionRecord extends BaseRecord implements ConnectionStorageProps {
  public state!: ConnectionState
  public role!: ConnectionRole

  @Type(() => DidDoc)
  public didDoc!: DidDoc
  public did!: string
  public verkey!: string

  @Type(() => DidDoc)
  public theirDidDoc?: DidDoc
  public theirDid?: string

  @Type(() => ConnectionInvitationMessage)
  public invitation?: ConnectionInvitationMessage
  public alias?: string
  public autoAcceptConnection?: boolean
  public tags!: ConnectionTags

  public static readonly type: 'ConnectionRecord'
  public readonly type = ConnectionRecord.type

  public constructor(props: ConnectionStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.did = props.did
      this.didDoc = props.didDoc
      this.verkey = props.verkey
      this.theirDid = props.theirDid
      this.theirDidDoc = props.theirDidDoc
      this.state = props.state
      this.role = props.role
      this.alias = props.alias
      this.autoAcceptConnection = props.autoAcceptConnection
      this.tags = props.tags
      this.invitation = props.invitation
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
      throw new Error(
        `Connection record is not ready to be used. Expected ${ConnectionState.Responded} or ${ConnectionState.Complete}, found invalid state ${this.state}`
      )
    }
  }

  public assertState(expectedStates: ConnectionState | ConnectionState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new Error(
        `Connection record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertRole(expectedRole: ConnectionRole) {
    if (this.role !== expectedRole) {
      throw new Error(`Connection record has invalid role ${this.role}. Expected role ${expectedRole}.`)
    }
  }
}
