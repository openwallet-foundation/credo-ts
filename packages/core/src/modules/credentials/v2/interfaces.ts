import { AnyJson } from '../../generic'
import { CredentialProtocolVersion } from '../CredentialProtocolVersion'
import { LinkedAttachment } from '../../../utils/LinkedAttachment'
import { CredentialPreviewAttribute } from '../'
import type { AutoAcceptCredential } from '../CredentialAutoAcceptType'


import { Attachment } from '../../../decorators/attachment/Attachment'
import { CredOffer } from 'indy-sdk'

type IssuerId = string

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
    [x: string]: any
  }
  format: {
    linkedDataProof: {
      proofType: Array<string | LDSignatureSuite>
    }
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

interface OfferCredentialOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: OfferCredentialFormats
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

interface AcceptOfferOptions {
  credentialRecordId: string
  comment?: string
  autoAcceptCredential?: AutoAcceptCredential
}

interface NegotiateOfferOptions {
  credentialRecordId: string  
  credentialFormats: OfferCredentialFormats
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

/// CREDENTIAL PROPOSAL

// this is the base64 encoded data payload for [Indy] credential proposal
interface CredPropose {
  attributes?: CredentialPreviewAttribute[] 
  schemaIssuerDid?: string
  schemaName?: string
  schemaVersion?: string
  schemaId?: string
  issuerDid?: string
  credentialDefinitionId?: string
  linkedAttachments?: LinkedAttachment[]
}

// ====================================================================================
// CredOffer is the base64 encoded data payload for [Indy] credential offer messages
// IMPORTANT! review this
export interface V2CredProposalFormat {
  indy?:CredPropose
  w3c?: {
    // MJR-TODO
  }
}
// ====================================================================================


interface ProposeCredentialOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersion
  credentialFormats: V2CredProposalFormat
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}


// ====================================================================================
// CredOffer is the base64 encoded data payload for [Indy] credential offer messages
// IMPORTANT! review this
export interface V2CredOfferFormat {
  indy?: {
      offer: CredOffer
  }
  w3c?: {
    // MJR-TODO
  }
}
// ====================================================================================

interface IndyCredentialPreview {
       // Could be that credential definition id and attributes are already defined
      // But could also be that they are undefined. So we can't make them required
  credentialDefinitionId?: string
  attributes?: CredentialPreviewAttribute[]
}
export type FormatType = AcceptProposalOptions | ProposeCredentialOptions

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
  credentialRecordId: string
  credentialFormats: OfferCredentialFormats
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

/// CREDENTIAL REQUEST

interface RequestCredentialFormats {
  // Indy cannot start from credential request
  w3c: W3CCredentialFormat
}

interface RequestCredentialOptions {
  connectionId: string
  // As indy cannot start from request and w3c is not supported in v1 we always use v2 here
  // protocolVersion: ProtocolVersion
  credentialFormats: RequestCredentialFormats
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

interface AcceptRequestOptions {
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
  NegotiateOfferOptions,
  RequestCredentialOptions,
  AcceptRequestOptions,
  CredPropose as IndyProposeCredentialFormat,
}
