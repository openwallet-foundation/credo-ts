import type { TagsBase } from '@credo-ts/core'
import type { DidCommProofRole, DidCommProofState } from '../models'
import type { DidCommAutoAcceptProof } from '../models/DidCommProofAutoAcceptType'

import { BaseRecord, CredoError, utils } from '@credo-ts/core'

export interface DidCommProofExchangeRecordProps {
  id?: string
  createdAt?: Date
  protocolVersion: string
  isVerified?: boolean
  state: DidCommProofState
  role: DidCommProofRole
  connectionId?: string
  threadId: string
  parentThreadId?: string
  tags?: CustomDidCommProofExchangeTags
  autoAcceptProof?: DidCommAutoAcceptProof
  errorMessage?: string
}

export type CustomDidCommProofExchangeTags = TagsBase
export type DefaultDidCommProofExchangeTags = {
  threadId: string
  parentThreadId?: string
  connectionId?: string
  state: DidCommProofState
  role: DidCommProofRole
}

export class DidCommProofExchangeRecord extends BaseRecord<DefaultDidCommProofExchangeTags, CustomDidCommProofExchangeTags> {
  public connectionId?: string
  public threadId!: string
  public protocolVersion!: string
  public parentThreadId?: string
  public isVerified?: boolean
  public state!: DidCommProofState
  public role!: DidCommProofRole
  public autoAcceptProof?: DidCommAutoAcceptProof
  public errorMessage?: string

  public static readonly type = 'ProofRecord'
  public readonly type = DidCommProofExchangeRecord.type

  public constructor(props: DidCommProofExchangeRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? utils.uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.protocolVersion = props.protocolVersion

      this.isVerified = props.isVerified
      this.state = props.state
      this.role = props.role
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
      role: this.role,
    }
  }

  public assertState(expectedStates: DidCommProofState | DidCommProofState[]) {
    if (!Array.isArray(expectedStates)) {
      // biome-ignore lint/style/noParameterAssign: <explanation>
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new CredoError(
        `Proof record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertProtocolVersion(version: string) {
    if (this.protocolVersion !== version) {
      throw new CredoError(
        `Proof record has invalid protocol version ${this.protocolVersion}. Expected version ${version}`
      )
    }
  }

  public assertConnection(currentConnectionId: string) {
    if (!this.connectionId) {
      throw new CredoError(
        'Proof record is not associated with any connection. This is often the case with connection-less presentation exchange'
      )
    }
    if (this.connectionId !== currentConnectionId) {
      throw new CredoError(
        `Proof record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      )
    }
  }
}
