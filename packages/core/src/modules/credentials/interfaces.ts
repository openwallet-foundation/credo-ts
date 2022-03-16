import type { Attachment } from '../../decorators/attachment/Attachment'
import type { LinkedAttachment } from '../../utils/LinkedAttachment'
import type { AnyJson } from '../generic'
import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type { CredentialProtocolVersion } from './CredentialProtocolVersion'
import type {
  CredentialProposeFormat,
  W3CCredentialFormat,
  CredentialDefinitionFormat,
} from './formats/models/CredentialFormatServiceOptions'
import type { CredentialPreviewAttribute } from './models/CredentialPreviewAttributes'
import type { CredOffer } from 'indy-sdk'

type IssuerId = string

export enum CredentialRecordType {
  Indy = 'Indy',
  W3c = 'W3c',
}

// keys used to create a format service
export enum CredentialFormatType {
  Indy = 'Indy',
  // JsonLd = 'jsonld',
  // others to follow
}

interface IssuerNode {
  id: string
  [x: string]: AnyJson
}

export type Issuer = IssuerId | IssuerNode

// CREDENTIAL OFFER
export interface IndyOfferCredentialFormat {
  credentialDefinitionId: string
  attributes: CredentialPreviewAttribute[]
  linkedAttachments?: LinkedAttachment[]
  payload?: CredOffer
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

interface NegotiateOfferOptions extends ProposeCredentialOptions {
  credentialRecordId?: string
  offer?: Attachment
}

/// CREDENTIAL PROPOSAL

interface ProposeCredentialOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: CredentialProposeFormat
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface IndyCredentialPreview {
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

// CREDENTIAL REQUEST
interface RequestCredentialOptions {
  connectionId?: string
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
