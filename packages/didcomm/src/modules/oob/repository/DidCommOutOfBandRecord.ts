import type { TagsBase } from '@credo-ts/core'
import { BaseRecord, CredoError, createRecordEncodingSchema, utils, zJsonTransformerClass } from '@credo-ts/core'
import { z } from 'zod'
import { getThreadIdFromPlainTextMessage } from '../../../util/thread'
import type { DidCommOutOfBandRole } from '../domain/DidCommOutOfBandRole'
import type { DidCommOutOfBandState } from '../domain/DidCommOutOfBandState'
import { DidCommOutOfBandInvitation } from '../messages'
import type { DidCommOutOfBandRecordMetadata } from './outOfBandRecordMetadataTypes'

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

const didCommOutOfBandRecordEncodingSchema = createRecordEncodingSchema({
  outOfBandInvitation: zJsonTransformerClass(() => DidCommOutOfBandInvitation, { validate: false }).optional(),
  role: z.string().optional(),
  state: z.string().optional(),
  alias: z.string().optional(),
  reusable: z.boolean().optional(),
  autoAcceptConnection: z.boolean().optional(),
  mediatorId: z.string().optional(),
  reuseConnectionId: z.string().optional(),
  invitationInlineServiceKeys: z
    .array(
      z.object({
        recipientKeyFingerprint: z.string(),
        kmsKeyId: z.string(),
      })
    )
    .optional(),
})

export class DidCommOutOfBandRecord extends BaseRecord<
  DefaultDidCommOutOfBandRecordTags,
  CustomDidCommOutOfBandRecordTags,
  DidCommOutOfBandRecordMetadata
> {
  public static get encodingSchema() {
    return didCommOutOfBandRecordEncodingSchema
  }

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
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `Invalid out-of-band record state ${this.state}, valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }
}
