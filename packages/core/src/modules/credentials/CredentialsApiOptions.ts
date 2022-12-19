import type { CFsFromCPs, GetFormatDataReturn } from './CredentialProtocolOptions'
import type { CredentialFormatPayload } from './formats'
import type { AutoAcceptCredential } from './models/CredentialAutoAcceptType'
import type { CredentialProtocol } from './protocol/CredentialProtocol'

// re-export GetFormatDataReturn type from service, as it is also used in the module
export type { GetFormatDataReturn }

export type FindCredentialProposalMessageReturn<CPs extends CredentialProtocol[] = CredentialProtocol[]> = ReturnType<
  CPs[number]['findProposalMessage']
>
export type FindCredentialOfferMessageReturn<CPs extends CredentialProtocol[] = CredentialProtocol[]> = ReturnType<
  CPs[number]['findOfferMessage']
>
export type FindCredentialRequestMessageReturn<CPs extends CredentialProtocol[] = CredentialProtocol[]> = ReturnType<
  CPs[number]['findRequestMessage']
>
export type FindCredentialMessageReturn<CPs extends CredentialProtocol[] = CredentialProtocol[]> = ReturnType<
  CPs[number]['findCredentialMessage']
>

/**
 * Get the supported protocol versions based on the provided credential protocols.
 */
export type CredentialProtocolVersionType<CPs extends CredentialProtocol[] = CredentialProtocol[]> =
  CPs[number]['version']

/**
 * Get the service map for usage in the credentials module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type ProtocolMap = CredentialProtocolMap<[IndyCredentialFormatService], [V1CredentialProtocol]>
 *
 * // equal to
 * type ProtocolMap = {
 *   v1: V1CredentialProtocol
 * }
 * ```
 */
export type CredentialProtocolMap<CPs extends CredentialProtocol[] = CredentialProtocol[]> = {
  [CP in CPs[number] as CP['version']]: CredentialProtocol
}

interface BaseOptions {
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

/**
 * Interface for CredentialsApi.proposeCredential. Will send a proposal.
 */
export interface ProposeCredentialOptions<CPs extends CredentialProtocol[] = CredentialProtocol[]> extends BaseOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersionType<CPs>
  credentialFormats: CredentialFormatPayload<CFsFromCPs<CPs>, 'createProposal'>
}

/**
 * Interface for CredentialsApi.acceptProposal. Will send an offer
 *
 * credentialFormats is optional because this is an accept method
 */
export interface AcceptCredentialProposalOptions<CPs extends CredentialProtocol[] = CredentialProtocol[]>
  extends BaseOptions {
  credentialRecordId: string
  credentialFormats?: CredentialFormatPayload<CFsFromCPs<CPs>, 'acceptProposal'>
}

/**
 * Interface for CredentialsApi.negotiateProposal. Will send an offer
 */
export interface NegotiateCredentialProposalOptions<CPs extends CredentialProtocol[] = CredentialProtocol[]>
  extends BaseOptions {
  credentialRecordId: string
  credentialFormats: CredentialFormatPayload<CFsFromCPs<CPs>, 'createOffer'>
}

/**
 * Interface for CredentialsApi.createOffer. Will create an out of band offer
 */
export interface CreateOfferOptions<CPs extends CredentialProtocol[] = CredentialProtocol[]> extends BaseOptions {
  protocolVersion: CredentialProtocolVersionType<CPs>
  credentialFormats: CredentialFormatPayload<CFsFromCPs<CPs>, 'createOffer'>
}

/**
 * Interface for CredentialsApi.offerCredentials. Extends CreateOfferOptions, will send an offer
 */
export interface OfferCredentialOptions<CPs extends CredentialProtocol[] = CredentialProtocol[]>
  extends BaseOptions,
    CreateOfferOptions<CPs> {
  connectionId: string
}

/**
 * Interface for CredentialsApi.acceptOffer. Will send a request
 *
 * credentialFormats is optional because this is an accept method
 */
export interface AcceptCredentialOfferOptions<CPs extends CredentialProtocol[] = CredentialProtocol[]>
  extends BaseOptions {
  credentialRecordId: string
  credentialFormats?: CredentialFormatPayload<CFsFromCPs<CPs>, 'acceptOffer'>
}

/**
 * Interface for CredentialsApi.negotiateOffer. Will send a proposal.
 */
export interface NegotiateCredentialOfferOptions<CPs extends CredentialProtocol[] = CredentialProtocol[]>
  extends BaseOptions {
  credentialRecordId: string
  credentialFormats: CredentialFormatPayload<CFsFromCPs<CPs>, 'createProposal'>
}

/**
 * Interface for CredentialsApi.acceptRequest. Will send a credential
 *
 * credentialFormats is optional because this is an accept method
 */
export interface AcceptCredentialRequestOptions<CPs extends CredentialProtocol[] = CredentialProtocol[]>
  extends BaseOptions {
  credentialRecordId: string
  credentialFormats?: CredentialFormatPayload<CFsFromCPs<CPs>, 'acceptRequest'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

/**
 * Interface for CredentialsApi.acceptCredential. Will send an ack message
 */
export interface AcceptCredentialOptions {
  credentialRecordId: string
}

/**
 * Interface for CredentialsApi.sendProblemReport. Will send a problem-report message
 */
export interface SendCredentialProblemReportOptions {
  credentialRecordId: string
  message: string
}
