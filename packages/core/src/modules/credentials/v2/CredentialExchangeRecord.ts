import { TagsBase, BaseRecord } from '../../../storage/BaseRecord'
import { AutoAcceptCredential } from '../CredentialAutoAcceptType'

import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { CredentialRole } from './CredentialRole'
import { CredentialState } from '../CredentialState'

export interface CredentialRecordTags {
  threadId: string
  protocolVersion: CredentialProtocolVersion
  state: CredentialState
  connectionId?: string
}

export enum CredentialRecordType {
  INDY,
  W3C,
}
export enum W3CFormatType {
  JSONLD
  // others to follow
}

export interface CredentialRecordBinding {
  credentialRecordType: CredentialRecordType
  credentialRecordId: string
}

export interface CredentialExchangeRecordProps {
  connectionId?: string
  protocolVersion: CredentialProtocolVersion
  threadId: string
  state: CredentialState
  tags?: TagsBase
  autoAcceptCredential?: AutoAcceptCredential
  role: CredentialRole
  credentials: CredentialRecordBinding[]
}

export class CredentialExchangeRecord extends BaseRecord {
  // in case of connection less exchange, connection id can be null
  public connectionId?: string

  // protocolVersion is the protocol version being used for the credential exchange
  public protocolVersion!: CredentialProtocolVersion
  public threadId!: string

  // enum as defined in Issue Credential V2 protocol
  public state!: CredentialState
  
  // tags stuff inherited from BaseRecord
  public tags?: TagsBase

  // Auto accept enum is already available in AFJ.
  // If auto accept is not defined we use the agent configuration
  public autoAcceptCredential?: AutoAcceptCredential

  // This can be a derived getter property (based on state and whether we have a credential)
  public role!: CredentialRole

  // This value binds the CredentialExchangeRecord to the actual credential records.
  // Because we can have multiple credential record types (Indy & W3C), a credential
  // record id alone doesn't tell us where to look for the credential.
  // Therefore we use the CredentialRecordBinding interface to specify the credential // record id, as well as the type.
  public credentials!: CredentialRecordBinding[]

  public constructor(props?: CredentialExchangeRecordProps) {
    super()

    if (props) {
      this.protocolVersion = props.protocolVersion
      this.threadId = props.threadId
      this.role = props.role
      this.connectionId = props.connectionId
      this.protocolVersion = props.protocolVersion
      this.threadId = props.threadId
      this.state = props.state
      this._tags = props.tags ?? {}
    }
  }

  public getTags(): TagsBase {
    return this._tags
  }
}





