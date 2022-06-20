import type { CredentialFormat, CredentialFormatPayload } from './formats'
import type { AutoAcceptCredential } from './models/CredentialAutoAcceptType'
import type { CredentialService } from './services'

export type FindProposalMessageReturn<CSs extends CredentialService[]> = ReturnType<CSs[number]['findProposalMessage']>
export type FindOfferMessageReturn<CSs extends CredentialService[]> = ReturnType<CSs[number]['findOfferMessage']>
export type FindRequestMessageReturn<CSs extends CredentialService[]> = ReturnType<CSs[number]['findRequestMessage']>
export type FindCredentialMessageReturn<CSs extends CredentialService[]> = ReturnType<
  CSs[number]['findCredentialMessage']
>

/**
 * Get the supported protocol versions based on the provided credential services.
 */
export type ProtocolVersionType<
  CFs extends CredentialFormat[],
  CSs extends CredentialService<CFs>[]
> = CSs[number]['version']

/**
 * Get the service map for usage in the credentials module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type CredentialServiceMap = ServiceMap<[IndyCredentialFormat], [V1CredentialService]>
 *
 * // equal to
 * type CredentialServiceMap = {
 *   v1: V1CredentialService
 * }
 * ```
 */
export type ServiceMap<CFs extends CredentialFormat[], CSs extends CredentialService<CFs>[]> = {
  [CS in CSs[number] as CS['version']]: CredentialService<CFs>
}

interface BaseOptions {
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

/**
 * Interface for CredentialsModule.proposeCredential. Will send a proposal.
 */
export interface ProposeCredentialOptions<
  CFs extends CredentialFormat[] = CredentialFormat[],
  CSs extends CredentialService<CFs>[] = CredentialService<CredentialFormat[]>[]
> extends BaseOptions {
  connectionId: string
  protocolVersion: ProtocolVersionType<CFs, CSs>
  credentialFormats: CredentialFormatPayload<CFs, 'createProposal'>
}

/**
 * Interface for CredentialsModule.acceptProposal. Will send an offer
 *
 * credentialFormats is optional because this is an accept method
 */
export interface AcceptProposalOptions<CFs extends CredentialFormat[] = CredentialFormat[]> extends BaseOptions {
  credentialRecordId: string
  credentialFormats?: CredentialFormatPayload<CFs, 'acceptProposal'>
}

/**
 * Interface for CredentialsModule.negotiateProposal. Will send an offer
 */
export interface NegotiateProposalOptions<CFs extends CredentialFormat[] = CredentialFormat[]> extends BaseOptions {
  credentialRecordId: string
  credentialFormats: CredentialFormatPayload<CFs, 'createOffer'>
}

/**
 * Interface for CredentialsModule.createOffer. Will create an out of band offer
 */
export interface CreateOfferOptions<
  CFs extends CredentialFormat[] = CredentialFormat[],
  CSs extends CredentialService<CFs>[] = CredentialService<CredentialFormat[]>[]
> extends BaseOptions {
  protocolVersion: ProtocolVersionType<CFs, CSs>
  credentialFormats: CredentialFormatPayload<CFs, 'createOffer'>
}

/**
 * Interface for CredentialsModule.offerCredentials. Extends CreateOfferOptions, will send an offer
 */
export interface OfferCredentialOptions<
  CFs extends CredentialFormat[] = CredentialFormat[],
  CSs extends CredentialService<CFs>[] = CredentialService<CredentialFormat[]>[]
> extends BaseOptions,
    CreateOfferOptions<CFs, CSs> {
  connectionId: string
}

/**
 * Interface for CredentialsModule.acceptOffer. Will send a request
 *
 * credentialFormats is optional because this is an accept method
 */
export interface AcceptOfferOptions<CFs extends CredentialFormat[] = CredentialFormat[]> extends BaseOptions {
  credentialRecordId: string
  credentialFormats?: CredentialFormatPayload<CFs, 'acceptOffer'>
}

/**
 * Interface for CredentialsModule.negotiateOffer. Will send a proposal.
 */
export interface NegotiateOfferOptions<CFs extends CredentialFormat[] = CredentialFormat[]> extends BaseOptions {
  credentialRecordId: string
  credentialFormats: CredentialFormatPayload<CFs, 'createProposal'>
}

/**
 * Interface for CredentialsModule.acceptRequest. Will send a credential
 *
 * credentialFormats is optional because this is an accept method
 */
export interface AcceptRequestOptions<CFs extends CredentialFormat[] = CredentialFormat[]> extends BaseOptions {
  credentialRecordId: string
  credentialFormats?: CredentialFormatPayload<CFs, 'acceptRequest'>
  autoAcceptCredential?: AutoAcceptCredential
  comment?: string
}

/**
 * Interface for CredentialsModule.acceptCredential. Will send an ack message
 */
export interface AcceptCredentialOptions {
  credentialRecordId: string
}
