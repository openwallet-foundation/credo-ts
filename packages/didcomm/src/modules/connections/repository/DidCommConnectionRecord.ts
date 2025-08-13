import type { TagsBase } from '@credo-ts/core'
import type { DidCommConnectionType } from '../models'
import type { DidCommConnectionMetadata } from './DidCommConnectionMetadataTypes'

import { BaseRecord, CredoError, utils } from '@credo-ts/core'
import { Transform } from 'class-transformer'

import {
  DidCommDidExchangeRole,
  DidCommDidExchangeState,
  DidCommHandshakeProtocol,
  rfc0160StateFromDidExchangeState,
} from '../models'

export interface DidCommConnectionRecordProps {
  id?: string
  createdAt?: Date
  did?: string
  theirDid?: string
  theirLabel?: string
  state: DidCommDidExchangeState
  role: DidCommDidExchangeRole
  alias?: string
  autoAcceptConnection?: boolean
  threadId?: string
  tags?: CustomDidCommConnectionTags
  imageUrl?: string
  mediatorId?: string
  errorMessage?: string
  protocol?: DidCommHandshakeProtocol
  outOfBandId?: string
  invitationDid?: string
  connectionTypes?: Array<DidCommConnectionType | string>
  previousDids?: Array<string>
  previousTheirDids?: Array<string>
}

export type CustomDidCommConnectionTags = TagsBase
export type DefaultDidCommConnectionTags = {
  state: DidCommDidExchangeState
  role: DidCommDidExchangeRole
  threadId?: string
  mediatorId?: string
  did?: string
  theirDid?: string
  outOfBandId?: string
  invitationDid?: string
  connectionTypes?: Array<DidCommConnectionType | string>
  previousDids?: Array<string>
  previousTheirDids?: Array<string>
}

export class DidCommConnectionRecord extends BaseRecord<
  DefaultDidCommConnectionTags,
  CustomDidCommConnectionTags,
  DidCommConnectionMetadata
> {
  public state!: DidCommDidExchangeState
  public role!: DidCommDidExchangeRole

  public did?: string

  public theirDid?: string
  public theirLabel?: string

  public alias?: string
  public autoAcceptConnection?: boolean
  public imageUrl?: string

  public threadId?: string
  public mediatorId?: string
  public errorMessage?: string

  // We used to store connection record using major.minor version, but we now
  // only store the major version, storing .x for the minor version. We have this
  // transformation so we don't have to migrate the data in the database.
  @Transform(
    ({ value }) => {
      if (!value || typeof value !== 'string' || value.endsWith('.x')) return value
      return `${value.split('.').slice(0, -1).join('.')}.x`
    },

    { toClassOnly: true }
  )
  public protocol?: DidCommHandshakeProtocol
  public outOfBandId?: string
  public invitationDid?: string

  public connectionTypes: string[] = []
  public previousDids: string[] = []
  public previousTheirDids: string[] = []

  public static readonly type = 'ConnectionRecord'
  public readonly type = DidCommConnectionRecord.type

  public readonly allowCache = DidCommConnectionRecord.allowCache
  public static readonly allowCache: boolean = true

  public constructor(props: DidCommConnectionRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
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
      this.mediatorId = props.mediatorId
      this.errorMessage = props.errorMessage
      this.protocol = props.protocol
      this.outOfBandId = props.outOfBandId
      this.connectionTypes = props.connectionTypes ?? []
      this.previousDids = props.previousDids ?? []
      this.previousTheirDids = props.previousTheirDids ?? []
    }
  }

  public getTags(): DefaultDidCommConnectionTags & CustomDidCommConnectionTags {
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
      connectionTypes: this.connectionTypes,
      previousDids: this.previousDids,
      previousTheirDids: this.previousTheirDids,
    }
  }

  public get isRequester() {
    return this.role === DidCommDidExchangeRole.Requester
  }

  public get rfc0160State() {
    return rfc0160StateFromDidExchangeState(this.state)
  }

  public get isReady() {
    return this.state && [DidCommDidExchangeState.Completed, DidCommDidExchangeState.ResponseSent].includes(this.state)
  }

  public assertReady() {
    if (!this.isReady) {
      throw new CredoError(
        `Connection record is not ready to be used. Expected ${DidCommDidExchangeState.ResponseSent}, ${DidCommDidExchangeState.ResponseReceived} or ${DidCommDidExchangeState.Completed}, found invalid state ${this.state}`
      )
    }
  }

  public assertState(expectedStates: DidCommDidExchangeState | DidCommDidExchangeState[]) {
    if (!Array.isArray(expectedStates)) {
      // biome-ignore lint/style/noParameterAssign: <explanation>
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `Connection record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertRole(expectedRole: DidCommDidExchangeRole) {
    if (this.role !== expectedRole) {
      throw new CredoError(`Connection record has invalid role ${this.role}. Expected role ${expectedRole}.`)
    }
  }
}
