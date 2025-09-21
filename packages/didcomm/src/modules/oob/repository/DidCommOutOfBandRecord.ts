import type { TagsBase } from '@credo-ts/core'
import type { DidCommOutOfBandRole } from '../domain/DidCommOutOfBandRole'
import type { DidCommOutOfBandState } from '../domain/DidCommOutOfBandState'
import type { DidCommOutOfBandRecordMetadata } from './outOfBandRecordMetadataTypes'

import { BaseRecord, CredoError, utils } from '@credo-ts/core'
import { Type } from 'class-transformer'

import { getThreadIdFromPlainTextMessage } from '../../../util/thread'
import { DidCommOutOfBandInvitation } from '../messages'

export interface DidCommOutOfBandInlineServiceKey {
  recipientKeyFingerprint: string
  kmsKeyId: string
}

type DefaultDidCommOutOfBandRecordTags = {
  role: DidCommOutOfBandRole
  state: DidCommOutOfBandState
  invitationId: string
  threadId?: string
  /**
   * The thread ids from the attached request messages from the out
   * of band invitation.
   */
  invitationRequestsThreadIds?: string[]
}

interface CustomDidCommOutOfBandRecordTags extends TagsBase {
  /**
   * The fingerprints of the recipient keys from the out of band invitation.
   * When we created the invitation this will be our keys, when we received this
   * invitation it will be the other parties' keys.
   */
  recipientKeyFingerprints: string[]

  /**
   * The fingerprint from the {@link OutOfBandRecordMetadataKeys.RecipientRouting} recipient key.
   *
   * This will always be a key from our recipient
   */
  recipientRoutingKeyFingerprint?: string
}

export interface DidCommOutOfBandRecordProps {
  id?: string
  createdAt?: Date
  updatedAt?: Date
  tags?: CustomDidCommOutOfBandRecordTags
  outOfBandInvitation: DidCommOutOfBandInvitation
  role: DidCommOutOfBandRole
  state: DidCommOutOfBandState
  alias?: string
  autoAcceptConnection?: boolean
  reusable?: boolean
  mediatorId?: string
  reuseConnectionId?: string
  threadId?: string

  /**
   * The keys associated with the inline services of the out of band invitation
   */
  invitationInlineServiceKeys?: DidCommOutOfBandInlineServiceKey[]
}

export class DidCommOutOfBandRecord extends BaseRecord<
  DefaultDidCommOutOfBandRecordTags,
  CustomDidCommOutOfBandRecordTags,
  DidCommOutOfBandRecordMetadata
> {
  @Type(() => DidCommOutOfBandInvitation)
  public outOfBandInvitation!: DidCommOutOfBandInvitation
  public role!: DidCommOutOfBandRole
  public state!: DidCommOutOfBandState
  public alias?: string
  public reusable!: boolean
  public autoAcceptConnection?: boolean
  public mediatorId?: string
  public reuseConnectionId?: string

  /**
   * The keys associated with the inline services of the out of band invitation
   */
  invitationInlineServiceKeys?: Array<DidCommOutOfBandInlineServiceKey>

  public static readonly type = 'OutOfBandRecord'
  public readonly type = DidCommOutOfBandRecord.type

  public constructor(props: DidCommOutOfBandRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.outOfBandInvitation = props.outOfBandInvitation
      this.role = props.role
      this.state = props.state
      this.alias = props.alias
      this.autoAcceptConnection = props.autoAcceptConnection
      this.reusable = props.reusable ?? false
      this.mediatorId = props.mediatorId
      this.reuseConnectionId = props.reuseConnectionId
      this.invitationInlineServiceKeys = props.invitationInlineServiceKeys
      this._tags = props.tags ?? { recipientKeyFingerprints: [] }
    }
  }

  public getTags() {
    return {
      ...this._tags,
      role: this.role,
      state: this.state,
      invitationId: this.outOfBandInvitation.id,
      threadId: this.outOfBandInvitation.threadId,
      invitationRequestsThreadIds: this.outOfBandInvitation
        .getRequests()
        ?.map((r) => getThreadIdFromPlainTextMessage(r)),
    }
  }

  public assertRole(expectedRole: DidCommOutOfBandRole) {
    if (this.role !== expectedRole) {
      throw new CredoError(`Invalid out-of-band record role ${this.role}, expected is ${expectedRole}.`)
    }
  }

  public assertState(expectedStates: DidCommOutOfBandState | DidCommOutOfBandState[]) {
    if (!Array.isArray(expectedStates)) {
      // biome-ignore lint/style/noParameterAssign: <explanation>
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `Invalid out-of-band record state ${this.state}, valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }
}
