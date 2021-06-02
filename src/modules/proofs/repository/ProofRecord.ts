import { Type } from 'class-transformer'

import { uuid } from '../../../utils/uuid'
import { BaseRecord, Tags } from '../../../storage/BaseRecord'
import { ProposePresentationMessage, RequestPresentationMessage, PresentationMessage } from '../messages'
import { ProofState } from '../ProofState'
import { AriesFrameworkError } from '../../../error'

export interface ProofRecordProps {
  id?: string
  createdAt?: Date

  isVerified?: boolean
  state: ProofState
  connectionId: string
  presentationId?: string
  tags: ProofRecordTags

  // message data
  proposalMessage?: ProposePresentationMessage
  requestMessage?: RequestPresentationMessage
  presentationMessage?: PresentationMessage
}
export interface ProofRecordTags extends Tags {
  threadId?: string
}

export class ProofRecord extends BaseRecord implements ProofRecordProps {
  public connectionId!: string
  public isVerified?: boolean
  public presentationId?: string
  public state!: ProofState
  public tags!: ProofRecordTags

  // message data
  @Type(() => ProposePresentationMessage)
  public proposalMessage?: ProposePresentationMessage
  @Type(() => RequestPresentationMessage)
  public requestMessage?: RequestPresentationMessage
  @Type(() => PresentationMessage)
  public presentationMessage?: PresentationMessage

  public static readonly type = 'ProofRecord'
  public readonly type = ProofRecord.type

  public constructor(props: ProofRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.proposalMessage = props.proposalMessage
      this.requestMessage = props.requestMessage
      this.presentationMessage = props.presentationMessage
      this.isVerified = props.isVerified
      this.state = props.state
      this.connectionId = props.connectionId
      this.presentationId = props.presentationId
      this.tags = props.tags as { [keys: string]: string }
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
    if (this.connectionId !== currentConnectionId) {
      throw new AriesFrameworkError(
        `Proof record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      )
    }
  }
}
