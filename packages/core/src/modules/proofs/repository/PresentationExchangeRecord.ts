import type { AutoAcceptProof } from '../models/ProofAutoAcceptType'
import type { ProofProtocolVersion } from '../models/ProofProtocolVersion'
import type { ProofRole } from '../models/ProofRole'
import type { ProofState } from '../models/ProofState'

export interface PresentationRecordTags {
  threadId: string
  protocolVersion: ProofProtocolVersion
  state: ProofState
  connectionId?: string
}

export enum PresentationRecordType {
  Indy = 'indy',
  JsonLD = 'JSON-LD',
}
export enum W3CFormatType {
  Jsonld = 'Jsonld',
  // others to follow
}

export interface PresentationRecordBinding {
  presentationRecordType: PresentationRecordType
  presentationRecordId: string
}

// Base Record already available in AFJ
export interface PresentationExchangeRecord {
  // in case of connection less exchange, connection id can be null
  connectionId?: string

  // protocolVersion is the protocol version being used for the presentation exchange
  protocolVersion: ProofProtocolVersion

  threadId: string

  // enum as defined in Present Proof V2 protocol
  state: ProofState

  // Auto accept enum is already available in AFJ.
  // If auto accept is not defined we use the agent configuration
  autoAcceptProof?: AutoAcceptProof

  role: ProofRole

  // This value binds the PresentationExchangeRecord to the actual proof records.
  // Because we can have multiple proof record types (Indy & W3c), a proof
  // record id alone doesn't tell us where to look for the proof.
  // Therefore we use the PresentationRecordBinding interface to specify the proof // record id, as well as the type.
  presentation: PresentationRecordBinding[]
}
