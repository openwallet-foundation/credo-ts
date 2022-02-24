import type { LinkedAttachment } from '../../utils/LinkedAttachment'
import type { AnyJson } from '../generic'
import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type { CredentialPreviewAttribute } from './CredentialPreviewAttributes'
import type { CredentialProtocolVersion } from './CredentialProtocolVersion'
import type { CredProposeOfferRequestFormat } from './formats/CredentialFormatService'
import type { CredentialDefinitionFormat } from './formats/models/CredentialFormatServiceOptions'

type IssuerId = string

export enum CredentialRecordType {
  Indy = 'Indy',
  W3c = 'W3c',
}

export enum CredentialFormatType {
  Indy = 'Indy',
  JsonLd = 'JsonLd',
  // others to follow
}

interface IssuerNode {
  id: string
  [x: string]: AnyJson
}

export type Issuer = IssuerId | IssuerNode
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LDSignatureSuite = 'Ed25519Signature2018' | 'BbsBlsSignature2020'

export interface W3CCredentialFormat {
  credential: {
    '@context': string | Record<string, AnyJson>
    issuer: Issuer
    type: string | string[]
    issuanceDate: string
    proof?: Record<string, AnyJson> | Array<Record<string, AnyJson>>
    [x: string]: unknown
  }
  options: {
    proofPurpose: string
    created: string
    domain: string
    challenge: string
    proofType: string
  }
}

/// CREDENTIAL OFFER
export interface IndyOfferCredentialFormat {
  credentialDefinitionId: string
  attributes: CredentialPreviewAttribute[]
  linkedAttachments?: LinkedAttachment[]
}

export interface OfferCredentialFormats {
  indy?: IndyOfferCredentialFormat
  w3c?: W3CCredentialFormat
}

// Used in OfferCredential
interface OfferCredentialOptions {
  connectionId?: string // this needs to be optional for out of band messages
  protocolVersion?: CredentialProtocolVersion
  credentialFormats: OfferCredentialFormats
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

interface AcceptOfferOptions {
  credentialRecordId: string
  protocolVersion?: CredentialProtocolVersion
  credentialRecordType?: CredentialRecordType
  connectionId?: string // this needs to be optional for out of band messages
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
}

/// CREDENTIAL PROPOSAL

interface ProposeCredentialOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: CredProposeOfferRequestFormat
  credentialRecordId?: string
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

interface IndyCredentialPreview {
  // Could be that credential definition id and attributes are already defined
  // But could also be that they are undefined. So we can't make them required
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
}
export type FormatType = AcceptProposalOptions | ProposeCredentialOptions | NegotiateProposalOptions

interface AcceptProposalOptions {
  attachId?: string
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialRecordId: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
  credentialFormats: {
    indy?: IndyCredentialPreview
    w3c?: {
      // todo
    }
  }
}

interface NegotiateProposalOptions {
  protocolVersion: CredentialProtocolVersion
  credentialRecordId: string
  credentialFormats: OfferCredentialFormats
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

/// CREDENTIAL REQUEST
// this is the base64 encoded data payload for [Indy] credential request

interface RequestCredentialOptions {
  attachId?: string
  connectionId?: string
  holderDid: string
  // As indy cannot start from request and w3c is not supported in v1 we always use v2 here
  credentialFormats?: CredProposeOfferRequestFormat
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
  offer?: CredProposeOfferRequestFormat // will not be there if this is a W3C request rather than an indy response to offer
  credentialDefinition?: CredentialDefinitionFormat
}

interface AcceptRequestOptions {
  attachId?: string
  protocolVersion: CredentialProtocolVersion
  credentialRecordId: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
  offer?: CredProposeOfferRequestFormat // might not be there if this is a W3C request rather than an indy response to offer
  request?: CredProposeOfferRequestFormat
}

export {
  OfferCredentialOptions,
  ProposeCredentialOptions,
  AcceptProposalOptions,
  NegotiateProposalOptions,
  AcceptOfferOptions,
  RequestCredentialOptions,
  AcceptRequestOptions,
}
