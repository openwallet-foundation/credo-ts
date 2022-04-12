import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type { CredentialProtocolVersion } from './CredentialProtocolVersion'
import type {
  FormatServiceOfferCredentialFormats,
  FormatServiceProposeCredentialFormats as FormatServiceProposeCredentialFormats,
  FormatServiceRequestCredentialFormats,
} from './formats/models/CredentialFormatServiceOptions'

// keys used to create a format service
export enum CredentialFormatType {
  Indy = 'Indy',
  // JsonLd = 'jsonld',
  // others to follow
}

interface BaseOptions {
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

// CREDENTIAL PROPOSAL
interface ProposeCredentialOptions extends BaseOptions {
  connectionId: string
  protocolVersion?: CredentialProtocolVersion
  credentialFormats: FormatServiceProposeCredentialFormats
}

interface AcceptProposalOptions extends BaseOptions {
  credentialRecordId: string
  credentialFormats: FormatServiceOfferCredentialFormats
}

interface NegotiateProposalOptions extends BaseOptions {
  credentialRecordId: string
  credentialFormats: FormatServiceOfferCredentialFormats
}
// CREDENTIAL OFFER
interface OfferCredentialOptions extends BaseOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: FormatServiceOfferCredentialFormats
}

interface AcceptOfferOptions extends BaseOptions {
  credentialRecordId: string
}

interface NegotiateOfferOptions extends ProposeCredentialOptions {
  credentialRecordId: string
}

// CREDENTIAL REQUEST
interface RequestCredentialOptions extends BaseOptions {
  connectionId?: string
  credentialFormats?: FormatServiceRequestCredentialFormats
}

interface AcceptRequestOptions extends BaseOptions {
  credentialRecordId: string
}

export {
  OfferCredentialOptions,
  ProposeCredentialOptions,
  AcceptProposalOptions,
  NegotiateProposalOptions,
  NegotiateOfferOptions,
  AcceptOfferOptions,
  RequestCredentialOptions,
  AcceptRequestOptions,
}
