import type { CredentialId } from 'indy-sdk'
import { v4 as uuid } from 'uuid'
import { BaseRecord, RecordType, Tags } from '../../../storage/BaseRecord'
import {
  ProposeCredentialMessage,
  IssueCredentialMessage,
  RequestCredentialMessage,
  OfferCredentialMessage,
} from '../messages'
import { CredentialState } from '../CredentialState'

export interface CredentialStorageProps {
  id?: string
  createdAt?: number
  state: CredentialState
  connectionId: string
  requestMetadata?: Record<string, unknown>
  credentialId?: CredentialId
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
  public connectionId: string
  public credentialId?: CredentialId
  public requestMetadata?: Record<string, unknown>
  public tags: CredentialRecordTags
  public state: CredentialState

  // message data
  public proposalMessage?: ProposeCredentialMessage
  public offerMessage?: OfferCredentialMessage
  public requestMessage?: RequestCredentialMessage
  public credentialMessage?: IssueCredentialMessage

  public type = RecordType.CredentialRecord
  public static type: RecordType = RecordType.CredentialRecord

  public constructor(props: CredentialStorageProps) {
    super(props.id ?? uuid(), props.createdAt ?? Date.now())
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
