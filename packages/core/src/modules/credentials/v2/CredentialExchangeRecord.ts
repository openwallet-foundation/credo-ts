import { BaseRecord } from '../../../storage/BaseRecord'
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

// Base Record already available in AFJ
export interface CredentialExchangeRecord {
  // in case of connection less exchange, connection id can be null
  connectionId?: string

  // protocolVersion is the protocol version being used for the credential exchange
  protocolVersion: CredentialProtocolVersion

  threadId: string

  // enum as defined in Issue Credential V2 protocol
  state: CredentialState

  // Auto accept enum is already available in AFJ.
  // If auto accept is not defined we use the agent configuration
  autoAcceptCredential?: AutoAcceptCredential

  // This can be a derived getter property (based on state and whether we have a credential)
  role: CredentialRole

  // This value binds the CredentialExchangeRecord to the actual credential records.
  // Because we can have multiple credential record types (Indy & W3C), a credential
  // record id alone doesn't tell us where to look for the credential.
  // Therefore we use the CredentialRecordBinding interface to specify the credential // record id, as well as the type.
  credentials: CredentialRecordBinding[]
}



