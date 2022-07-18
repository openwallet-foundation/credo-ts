import type { MediatorPickupStrategy } from '../MediatorPickupStrategy'
import type { MediationRole } from '../models/MediationRole'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { MediationState } from '../models/MediationState'

export interface MediationRecordProps {
  id?: string
  state: MediationState
  role: MediationRole
  createdAt?: Date
  did: string
  connectionId?: string
  threadId: string
  endpoint?: string
  recipientKeys?: string[]
  routingKeys?: string[]
  pickupStrategy?: MediatorPickupStrategy
  tags?: CustomMediationTags
}

export type CustomMediationTags = {
  default?: boolean
}

export type DefaultMediationTags = {
  role: MediationRole
  did: string
  state: MediationState
  threadId: string
}

export class MediationRecord
  extends BaseRecord<DefaultMediationTags, CustomMediationTags>
  implements MediationRecordProps
{
  public state!: MediationState
  public role!: MediationRole
  public did!: string
  public connectionId?: string
  public threadId!: string
  public endpoint?: string
  public recipientKeys!: string[]
  public routingKeys!: string[]
  public pickupStrategy?: MediatorPickupStrategy

  public static readonly type = 'MediationRecord'
  public readonly type = MediationRecord.type

  public constructor(props: MediationRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.did = props.did
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
      did: this.did,
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
    return this.state === MediationState.Granted
  }

  public assertReady() {
    if (!this.isReady) {
      throw new AriesFrameworkError(
        `Mediation record is not ready to be used. Expected ${MediationState.Granted}, found invalid state ${this.state}`
      )
    }
  }

  public assertState(expectedStates: MediationState | MediationState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new AriesFrameworkError(
        `Mediation record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertRole(expectedRole: MediationRole) {
    if (this.role !== expectedRole) {
      throw new AriesFrameworkError(`Mediation record has invalid role ${this.role}. Expected role ${expectedRole}.`)
    }
  }
}
