import type { LinkedAttachment } from '../../utils/LinkedAttachment'
import type { AnyJson } from '../generic'
import type { AutoAcceptCredential } from './CredentialAutoAcceptType'
import type { CredentialPreviewAttribute } from './CredentialPreviewAttributes'
import type { CredentialProtocolVersion } from './CredentialProtocolVersion'
import type { V2CredProposeOfferRequestFormat } from './v2/formats/CredentialFormatService'
import type { CredDef } from 'indy-sdk'

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
}

export interface OfferCredentialFormats {
  indy?: IndyOfferCredentialFormat
  w3c?: W3CCredentialFormat
}

// Used in OfferCredential
interface OfferCredentialOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: OfferCredentialFormats
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

interface AcceptOfferOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialRecordId: string
  credentialRecordType: CredentialRecordType
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
}

// interface NegotiateOfferOptions {
//   protocolVersion: CredentialProtocolVersion
//   credentialRecordId: string
//   credentialFormats: OfferCredentialFormats
//   autoAcceptCredential?: AutoAcceptCredential
//   comment?: string
// }

/// CREDENTIAL PROPOSAL

// this is the base64 encoded data payload for [Indy] credential proposal
export interface CredPropose {
  attributes?: CredentialPreviewAttribute[]
  schemaIssuerDid?: string
  schemaName?: string
  schemaVersion?: string
  schemaId?: string
  issuerDid?: string
  credentialDefinitionId?: string
  linkedAttachments?: LinkedAttachment[]
  cred_def_id?: string
}

interface ProposeCredentialOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: V2CredProposeOfferRequestFormat
  credentialRecordId?: string
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

export interface V2CredDefinitionFormat {
  indy?: {
    credentialDefinition: CredDef
  }
  w3c?: {
    // MJR-TODO
  }
}

interface IndyCredentialPreview {
  // Could be that credential definition id and attributes are already defined
  // But could also be that they are undefined. So we can't make them required
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
}
export type FormatType = AcceptProposalOptions | ProposeCredentialOptions | NegotiateProposalOptions

interface AcceptProposalOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialRecordId: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
  credentialFormats: {
    indy?: IndyCredentialPreview
    w3c?: {
      // MJR-TODO
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
  connectionId?: string
  holderDid: string
  // As indy cannot start from request and w3c is not supported in v1 we always use v2 here
  credentialFormats?: V2CredProposeOfferRequestFormat
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
  offer?: V2CredProposeOfferRequestFormat // will not be there if this is a W3C request rather than an indy response to offer
  credentialDefinition?: V2CredDefinitionFormat
}

interface AcceptRequestOptions {
  protocolVersion: CredentialProtocolVersion
  credentialRecordId: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
}

export {
  OfferCredentialOptions,
  ProposeCredentialOptions,
  AcceptProposalOptions,
  NegotiateProposalOptions,
  AcceptOfferOptions,
  RequestCredentialOptions,
  AcceptRequestOptions,
  CredPropose as IndyProposeCredentialFormat,
}
