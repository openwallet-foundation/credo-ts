import { Type } from 'class-transformer'
import { uuid } from '../../../utils/uuid'
import { BaseRecord, Tags } from '../../../storage/BaseRecord'
import {
  ProposeCredentialMessage,
  IssueCredentialMessage,
  RequestCredentialMessage,
  OfferCredentialMessage,
  CredentialPreviewAttribute,
} from '../messages'
import { CredentialState } from '../CredentialState'
import { CredentialInfo } from '../models/CredentialInfo'

export interface CredentialRecordMetadata {
  requestMetadata?: Record<string, unknown>
  credentialDefinitionId?: string
  schemaId?: string
}

export interface CredentialStorageProps {
  id?: string
  createdAt?: Date
  state: CredentialState
  connectionId: string

  credentialId?: string
  metadata?: CredentialRecordMetadata
  tags?: CredentialRecordTags
  proposalMessage?: ProposeCredentialMessage
  offerMessage?: OfferCredentialMessage
  requestMessage?: RequestCredentialMessage
  credentialMessage?: IssueCredentialMessage
  credentialAttributes?: CredentialPreviewAttribute[]
}

export interface CredentialRecordTags extends Tags {
  threadId?: string
}

export class CredentialRecord extends BaseRecord implements CredentialStorageProps {
  public connectionId!: string
  public credentialId?: string
  public tags!: CredentialRecordTags
  public state!: CredentialState
  public metadata!: CredentialRecordMetadata

  // message data
  @Type(() => ProposeCredentialMessage)
  public proposalMessage?: ProposeCredentialMessage
  @Type(() => OfferCredentialMessage)
  public offerMessage?: OfferCredentialMessage
  @Type(() => RequestCredentialMessage)
  public requestMessage?: RequestCredentialMessage
  @Type(() => IssueCredentialMessage)
  public credentialMessage?: IssueCredentialMessage

  @Type(() => CredentialPreviewAttribute)
  public credentialAttributes?: CredentialPreviewAttribute[]

  public static readonly type = 'CredentialRecord'
  public readonly type = CredentialRecord.type

  public constructor(props: CredentialStorageProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.createdAt = props.createdAt ?? new Date()
      this.state = props.state
      this.connectionId = props.connectionId
      this.metadata = props.metadata ?? {}
      this.credentialId = props.credentialId
      this.tags = (props.tags as { [keys: string]: string }) ?? {}

      this.proposalMessage = props.proposalMessage
      this.offerMessage = props.offerMessage
      this.requestMessage = props.requestMessage
      this.credentialMessage = props.credentialMessage
      this.credentialAttributes = props.credentialAttributes
    }
  }

  public getCredentialInfo(): CredentialInfo | null {
    if (!this.credentialAttributes) return null

    const claims = this.credentialAttributes.reduce(
      (accumulator, current) => ({
        ...accumulator,
        [current.name]: current.value,
      }),
      {}
    )

    return new CredentialInfo({
      claims,
      metadata: {
        credentialDefinitionId: this.metadata.credentialDefinitionId,
        schemaId: this.metadata.schemaId,
      },
    })
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
