import type { DidCommMediationRole } from '../models/DidCommMediationRole'

import { BaseRecord, CredoError, utils } from '@credo-ts/core'
import { Transform } from 'class-transformer'

import { DidCommMediatorPickupStrategy } from '../DidCommMediatorPickupStrategy'
import { DidCommMediationState } from '../models/DidCommMediationState'

export interface DidCommMediationRecordProps {
  id?: string
  state: DidCommMediationState
  role: DidCommMediationRole
  createdAt?: Date
  connectionId: string
  threadId: string
  endpoint?: string
  recipientKeys?: string[]
  routingKeys?: string[]
  pickupStrategy?: DidCommMediatorPickupStrategy
  tags?: CustomDidCommMediationTags
}

export type CustomDidCommMediationTags = {
  default?: boolean
}

export type DefaultDidCommMediationTags = {
  role: DidCommMediationRole
  connectionId: string
  state: DidCommMediationState
  threadId: string
}

export class DidCommMediationRecord
  extends BaseRecord<DefaultDidCommMediationTags, CustomDidCommMediationTags>
  implements DidCommMediationRecordProps
{
  public state!: DidCommMediationState
  public role!: DidCommMediationRole
  public connectionId!: string
  public threadId!: string
  public endpoint?: string

  /**
   * Base58 encoded recipient keys
   */
  public recipientKeys!: string[]

  /**
   * Base58 encoded routing keys
   */
  public routingKeys!: string[]

  @Transform(({ value }) => {
    if (value === 'Explicit') {
      return DidCommMediatorPickupStrategy.PickUpV1
    }
    return value
  })
  public pickupStrategy?: DidCommMediatorPickupStrategy

  public static readonly type = 'MediationRecord'
  public readonly type = DidCommMediationRecord.type

  public static readonly allowCache = true
  public readonly allowCache = true

  public constructor(props: DidCommMediationRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.connectionId = props.connectionId
      this.threadId = props.threadId
      this.recipientKeys = props.recipientKeys || []
      this.routingKeys = props.routingKeys || []
      this.state = props.state
      this.role = props.role
      this.endpoint = props.endpoint ?? undefined
      this.pickupStrategy = props.pickupStrategy
      this._tags = props.tags ?? {}
    }
  }

  public getTags() {
    return {
      ...this._tags,
      state: this.state,
      role: this.role,
      connectionId: this.connectionId,
      threadId: this.threadId,
      recipientKeys: this.recipientKeys,
    }
  }

  public addRecipientKey(recipientKey: string) {
    this.recipientKeys.push(recipientKey)
  }

  public removeRecipientKey(recipientKey: string): boolean {
    const index = this.recipientKeys.indexOf(recipientKey, 0)
    if (index > -1) {
      this.recipientKeys.splice(index, 1)
      return true
    }

    return false
  }

  public get isReady() {
    return this.state === DidCommMediationState.Granted
  }

  public assertReady() {
    if (!this.isReady) {
      throw new CredoError(
        `Mediation record is not ready to be used. Expected ${DidCommMediationState.Granted}, found invalid state ${this.state}`
      )
    }
  }

  public assertState(expectedStates: DidCommMediationState | DidCommMediationState[]) {
    if (!Array.isArray(expectedStates)) {
      // biome-ignore lint/style/noParameterAssign: <explanation>
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `Mediation record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertRole(expectedRole: DidCommMediationRole) {
    if (this.role !== expectedRole) {
      throw new CredoError(`Mediation record has invalid role ${this.role}. Expected role ${expectedRole}.`)
    }
  }
}
