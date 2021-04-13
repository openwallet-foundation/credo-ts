import { v4 as uuid } from 'uuid'
import { classToPlain, plainToClass } from 'class-transformer'
import { BaseRecord, RecordType, Tags } from '../../../storage/BaseRecord'
import { ConnectionState } from '..'
import { ConnectionInvitationMessage } from '..'
import { ConnectionRole } from '..'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { DidDoc } from '..'
import { IndyAgentService } from '..'
import type { Did, Verkey } from 'indy-sdk'

interface ConnectionProps {
  id?: string
  createdAt?: number
  did: Did
  didDoc: DidDoc
  verkey: Verkey
  theirDid?: Did
  theirDidDoc?: DidDoc
  invitation?: ConnectionInvitationMessage
  state: ConnectionState
  role: ConnectionRole
  endpoint?: string
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
  public did: Did
  private _didDoc!: Record<string, unknown>
  public verkey: Verkey
  public theirDid?: Did
  private _theirDidDoc?: Record<string, unknown>
  private _invitation?: Record<string, unknown>
  public state: ConnectionState
  public role: ConnectionRole
  public endpoint?: string
  public alias?: string
  public autoAcceptConnection?: boolean
  public tags: ConnectionTags

  public static readonly type: RecordType = RecordType.ConnectionRecord
  public readonly type = ConnectionRecord.type

  public constructor(props: ConnectionStorageProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now())
    this.did = props.did
    this.didDoc = props.didDoc
    this.verkey = props.verkey
    this.theirDid = props.theirDid
    this.theirDidDoc = props.theirDidDoc
    this.state = props.state
    this.role = props.role
    this.endpoint = props.endpoint
    this.alias = props.alias
    this.autoAcceptConnection = props.autoAcceptConnection
    this.tags = props.tags
    this.invitation = props.invitation

    // We need a better approach for this. After retrieving the connection message from
    // persistence it is plain json, so we need to transform it to a message class
    // if transform all record classes with class transformer this wouldn't be needed anymore
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const _invitation = props._invitation
    if (_invitation) {
      this._invitation = _invitation
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const _didDoc = props._didDoc
    if (_didDoc) {
      this._didDoc = _didDoc
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const _theirDidDoc = props._theirDidDoc
    if (_theirDidDoc) {
      this._theirDidDoc = _theirDidDoc
    }
  }

  public get invitation() {
    if (this._invitation) return JsonTransformer.fromJSON(this._invitation, ConnectionInvitationMessage)
  }

  public set invitation(invitation: ConnectionInvitationMessage | undefined) {
    if (invitation) this._invitation = JsonTransformer.toJSON(invitation)
  }

  public get didDoc() {
    return plainToClass(DidDoc, this._didDoc)
  }

  public set didDoc(didDoc: DidDoc) {
    this._didDoc = classToPlain(didDoc)
  }

  public get theirDidDoc() {
    if (this._theirDidDoc) return plainToClass(DidDoc, this._theirDidDoc)
  }

  public set theirDidDoc(didDoc: DidDoc | undefined) {
    this._theirDidDoc = classToPlain(didDoc)
  }

  public get myKey() {
    const [service] = this.didDoc?.getServicesByClassType(IndyAgentService) ?? []

    if (!service) {
      return null
    }

    return service.recipientKeys[0]
  }

  public get theirKey() {
    const [service] = this.theirDidDoc?.getServicesByClassType(IndyAgentService) ?? []

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

  public hasInboundEndpoint() {
    return this.didDoc.service.find((s) => s.serviceEndpoint !== 'didcomm:transport/queue')
  }
}
