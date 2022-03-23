import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type { CredentialProtocolVersion } from './CredentialProtocolVersion'
import type {
  IndyOfferCredentialFormat,
  OfferCredentialFormats,
  ProposeCredentialFormats,
  RequestCredentialFormats,
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
  protocolVersion: CredentialProtocolVersion
  credentialFormats: ProposeCredentialFormats
}

interface AcceptProposalOptions extends BaseOptions {
  connectionId?: string
  credentialRecordId: string
  credentialFormats: {
    indy?: IndyOfferCredentialFormat
    jsonld?: {
      // todo
    }
  }
}

interface NegotiateProposalOptions extends BaseOptions {
  connectionId?: string
  credentialRecordId: string
  credentialFormats: OfferCredentialFormats
}
// CREDENTIAL OFFER
interface OfferCredentialOptions extends BaseOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: OfferCredentialFormats
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
  credentialFormats?: RequestCredentialFormats
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
