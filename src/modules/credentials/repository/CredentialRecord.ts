import { Type } from 'class-transformer'
import { uuid } from '../../../utils/uuid'
import { BaseRecord, Tags } from '../../../storage/BaseRecord'
import {
  ProposeCredentialMessage,
  IssueCredentialMessage,
  RequestCredentialMessage,
  OfferCredentialMessage,
} from '../messages'
import { CredentialState } from '../CredentialState'

export interface CredentialStorageProps {
  id?: string
  createdAt?: Date
  state: CredentialState
  connectionId: string
  requestMetadata?: Record<string, unknown>
  credentialId?: string
  tags: CredentialRecordTags
  proposalMessage?: ProposeCredentialMessage
  offerMessage?: OfferCredentialMessage
  requestMessage?: RequestCredentialMessage
  credentialMessage?: IssueCredentialMessage
}

export interface CredentialRecordTags extends Tags {
  threadId?: string
}

export class CredentialRecord extends BaseRecord implements CredentialStorageProps {
  public connectionId!: string
  public credentialId?: string
  public requestMetadata?: Record<string, unknown>
  public tags!: CredentialRecordTags
  public state!: CredentialState

  // message data
  @Type(() => ProposeCredentialMessage)
  public proposalMessage?: ProposeCredentialMessage
  @Type(() => OfferCredentialMessage)
  public offerMessage?: OfferCredentialMessage
  @Type(() => RequestCredentialMessage)
  public requestMessage?: RequestCredentialMessage
  @Type(() => IssueCredentialMessage)
  public credentialMessage?: IssueCredentialMessage

  public static readonly type = 'CredentialRecord'
  public readonly type = CredentialRecord.type

  public constructor(props: CredentialStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.state = props.state
      this.connectionId = props.connectionId
      this.requestMetadata = props.requestMetadata
      this.credentialId = props.credentialId
      this.tags = props.tags as { [keys: string]: string }

      this.proposalMessage = props.proposalMessage
      this.offerMessage = props.offerMessage
      this.requestMessage = props.requestMessage
      this.credentialMessage = props.credentialMessage
    }
  }

  public assertState(expectedStates: CredentialState | CredentialState[]) {
    if (!Array.isArray(expectedStates)) {
      expectedStates = [expectedStates]
    }

    if (!expectedStates.includes(this.state)) {
      throw new Error(
        `Credential record is in invalid state ${this.state}. Valid states are: ${expectedStates.join(', ')}.`
      )
    }
  }

  public assertConnection(currentConnectionId: string) {
    if (this.connectionId !== currentConnectionId) {
      throw new Error(
        `Credential record is associated with connection '${this.connectionId}'. Current connection is '${currentConnectionId}'`
      )
    }
  }
}
