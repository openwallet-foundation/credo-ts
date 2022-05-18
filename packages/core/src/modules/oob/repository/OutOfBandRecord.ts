import type { TagsBase } from '../../../storage/BaseRecord'
import type { Key } from '../../dids'
import type { OutOfBandDidCommService } from '../domain/OutOfBandDidCommService'
import type { OutOfBandRole } from '../domain/OutOfBandRole'
import type { OutOfBandState } from '../domain/OutOfBandState'

import { Type } from 'class-transformer'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { DidKey } from '../../dids'
import { OutOfBandInvitation } from '../messages'

export interface OutOfBandRecordProps {
  id?: string
  createdAt?: Date
  updatedAt?: Date
  tags?: TagsBase
  outOfBandInvitation: OutOfBandInvitation
  role: OutOfBandRole
  state: OutOfBandState
  autoAcceptConnection?: boolean
  reusable?: boolean
  did?: string
  mediatorId?: string
  reuseConnectionId?: string
}

type DefaultOutOfBandRecordTags = {
  role: OutOfBandRole
  state: OutOfBandState
  invitationId: string
  recipientKeyFingerprints: string[]
}

export class OutOfBandRecord extends BaseRecord<DefaultOutOfBandRecordTags> {
  @Type(() => OutOfBandInvitation)
  public outOfBandInvitation!: OutOfBandInvitation
  public role!: OutOfBandRole
  public state!: OutOfBandState
  public reusable!: boolean
  public autoAcceptConnection?: boolean
  public did?: string
  public mediatorId?: string
  public reuseConnectionId?: string

  public static readonly type = 'OutOfBandRecord'
  public readonly type = OutOfBandRecord.type

  public constructor(props: OutOfBandRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.outOfBandInvitation = props.outOfBandInvitation
      this.role = props.role
      this.state = props.state
      this.autoAcceptConnection = props.autoAcceptConnection
      this.reusable = props.reusable ?? false
      this.did = props.did
      this.mediatorId = props.mediatorId
      this.reuseConnectionId = props.reuseConnectionId
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      role: this.role,
      state: this.state,
      invitationId: this.outOfBandInvitation.id,
      recipientKeyFingerprints: this.getRecipientKeys().map((key) => key.fingerprint),
    }
  }

  // TODO: this only takes into account inline didcomm services, won't work for public dids
  public getRecipientKeys(): Key[] {
    return this.outOfBandInvitation.services
      .filter((s): s is OutOfBandDidCommService => typeof s !== 'string')
      .map((s) => s.recipientKeys)
      .reduce((acc, curr) => [...acc, ...curr], [])
      .map((didKey) => DidKey.fromDid(didKey).key)
  }

  public assertRole(expectedRole: OutOfBandRole) {
    if (this.role !== expectedRole) {
      throw new AriesFrameworkError(`Invalid out-of-band record role ${this.role}, expected is ${expectedRole}.`)
    }
  }

  public assertState(expectedStates: OutOfBandState | OutOfBandState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new AriesFrameworkError(
        `Invalid out-of-band record state ${this.state}, valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }
}
