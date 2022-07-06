import type { TagsBase } from '../../../storage/BaseRecord'
import type { AutoAcceptProof } from '../models/ProofAutoAcceptType'
import type { ProofProtocolVersion } from '../models/ProofProtocolVersion'
import type { ProofState } from '../models/ProofState'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export interface ProofRecordProps {
  id?: string
  createdAt?: Date
  protocolVersion: ProofProtocolVersion
  isVerified?: boolean
  state: ProofState
  connectionId?: string
  threadId: string
  tags?: CustomProofTags
  autoAcceptProof?: AutoAcceptProof
  errorMessage?: string
}

export type CustomProofTags = TagsBase
export type DefaultProofTags = {
  threadId: string
  connectionId?: string
  state: ProofState
}

// T-TODO: rename to proof exchange record

export class ProofRecord extends BaseRecord<DefaultProofTags, CustomProofTags> {
  public connectionId?: string
  public threadId!: string
  public protocolVersion!: ProofProtocolVersion
  public isVerified?: boolean
  public state!: ProofState
  public autoAcceptProof?: AutoAcceptProof
  public errorMessage?: string

  public static readonly type = 'ProofRecord'
  public readonly type = ProofRecord.type

  public constructor(props: ProofRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.protocolVersion = props.protocolVersion

      this.isVerified = props.isVerified
      this.state = props.state
      this.connectionId = props.connectionId
      this.threadId = props.threadId

      this.autoAcceptProof = props.autoAcceptProof
      this._tags = props.tags ?? {}
      this.errorMessage = props.errorMessage
    }
  }

  public getTags() {
    return {
      ...this._tags,
      threadId: this.threadId,
      connectionId: this.connectionId,
      state: this.state,
    }
  }

  public assertState(expectedStates: ProofState | ProofState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new AriesFrameworkError(
        `Proof record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertConnection(currentConnectionId: string) {
    if (!this.connectionId) {
      throw new AriesFrameworkError(
        `Proof record is not associated with any connection. This is often the case with connection-less presentation exchange`
      )
    } else if (this.connectionId !== currentConnectionId) {
      throw new AriesFrameworkError(
        `Proof record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      )
    }
  }
}
