import type { Attachment } from '../../decorators/attachment/Attachment'
import type { LinkedAttachment } from '../../utils/LinkedAttachment'
import type { AnyJson } from '../generic'
import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type { CredentialProtocolVersion } from './CredentialProtocolVersion'
import type {
  CredProposeOfferRequestFormat,
  CredentialDefinitionFormat,
  W3CCredentialFormat,
} from './formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from './models/CredentialPreviewAttributes'

type IssuerId = string

export enum CredentialRecordType {
  Indy = 'Indy',
  W3c = 'W3c',
}

// keys used to create a format service
export enum CredentialFormatType {
  Indy = 'Indy',
  JsonLd = 'jsonld',
  // others to follow
}

interface IssuerNode {
  id: string
  [x: string]: AnyJson
}

export type Issuer = IssuerId | IssuerNode
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LDSignatureSuite = 'Ed25519Signature2018' | 'BbsBlsSignature2020'

/// CREDENTIAL OFFER
export interface IndyOfferCredentialFormat {
  credentialDefinitionId: string
  attributes: CredentialPreviewAttribute[]
  linkedAttachments?: LinkedAttachment[]
}

export interface OfferCredentialFormats {
  indy?: IndyOfferCredentialFormat
  jsonld?: undefined
}

interface OfferCredentialOptions {
  connectionId?: string // this needs to be optional for out of band messages
  protocolVersion?: CredentialProtocolVersion
  credentialFormats: OfferCredentialFormats
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
  offer?: Attachment
}

interface AcceptOfferOptions {
  credentialRecordId: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
}

interface NegotiateOfferOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: CredProposeOfferRequestFormat
  credentialRecordId?: string
  autoAcceptCredential?: AutoAcceptCredential
  offer?: Attachment
  comment?: string
}

/// CREDENTIAL PROPOSAL

interface ProposeCredentialOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: CredProposeOfferRequestFormat
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface IndyCredentialPreview {
  // Could be that credential definition id and attributes are already defined
  // But could also be that they are undefined. So we can't make them required
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
}
export type FormatType = AcceptProposalOptions | ProposeCredentialOptions | NegotiateProposalOptions

interface AcceptProposalOptions {
  connectionId: string
  credentialRecordId: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
  offerAttachment?: Attachment
  proposal?: Attachment
  credentialFormats: {
    indy?: IndyCredentialPreview
    jsonld?: W3CCredentialFormat
  }
}

interface NegotiateProposalOptions {
  connectionId?: string
  credentialRecordId: string
  credentialFormats: OfferCredentialFormats
  autoAcceptCredential?: AutoAcceptCredential
  offerAttachment?: Attachment
  comment?: string
}

/// CREDENTIAL REQUEST
interface RequestCredentialOptions {
  connectionId?: string
  // holderDid: string
  // As indy cannot start from request and w3c is not supported in v1 we always use v2 here
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
  offerAttachment?: Attachment
  requestAttachment?: Attachment
  credentialDefinition?: CredentialDefinitionFormat
}

interface AcceptRequestOptions {
  credentialRecordId: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
  offerAttachment?: Attachment
  requestAttachment?: Attachment
}

interface AcceptCredentialOptions {
  credential?: Attachment
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
  AcceptCredentialOptions,
}
