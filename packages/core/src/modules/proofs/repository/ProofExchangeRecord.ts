import type { TagsBase } from '../../../storage/BaseRecord'
import type { AutoAcceptProof } from '../models/ProofAutoAcceptType'
import type { ProofState } from '../models/ProofState'

import { AriesFrameworkError } from '../../../error'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'

export interface ProofExchangeRecordProps {
  id?: string
  createdAt?: Date
  protocolVersion: string
  isVerified?: boolean
  state: ProofState
  connectionId?: string
  threadId: string
  parentThreadId?: string
  tags?: CustomProofTags
  autoAcceptProof?: AutoAcceptProof
  errorMessage?: string
}

export type CustomProofTags = TagsBase
export type DefaultProofTags = {
  threadId: string
  parentThreadId?: string
  connectionId?: string
  state: ProofState
}

export class ProofExchangeRecord extends BaseRecord<DefaultProofTags, CustomProofTags> {
  public connectionId?: string
  public threadId!: string
  public protocolVersion!: string
  public parentThreadId?: string
  public isVerified?: boolean
  public state!: ProofState
  public autoAcceptProof?: AutoAcceptProof
  public errorMessage?: string

  public static readonly type = 'ProofRecord'
  public readonly type = ProofExchangeRecord.type

  public constructor(props: ProofExchangeRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.protocolVersion = props.protocolVersion

      this.isVerified = props.isVerified
      this.state = props.state
      this.connectionId = props.connectionId
      this.threadId = props.threadId
      this.parentThreadId = props.parentThreadId
      this.autoAcceptProof = props.autoAcceptProof
      this._tags = props.tags ?? {}
      this.errorMessage = props.errorMessage
    }
  }

  public getTags() {
    return {
      ...this._tags,
      threadId: this.threadId,
      parentThreadId: this.parentThreadId,
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

  public assertProtocolVersion(version: string) {
    if (this.protocolVersion !== version) {
      throw new AriesFrameworkError(
        `Proof record has invalid protocol version ${this.protocolVersion}. Expected version ${version}`
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
