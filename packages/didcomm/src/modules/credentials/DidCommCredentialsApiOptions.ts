import type { DidCommCredentialFormatPayload } from './formats'
import type { DidCommAutoAcceptCredential } from './models'
import type { DidCommCredentialProtocol } from './protocol/DidCommCredentialProtocol'
import type {
  CredentialFormatsFromProtocols,
  DeleteCredentialOptions,
  GetCredentialFormatDataReturn,
} from './protocol/DidCommCredentialProtocolOptions'

// re-export GetCredentialFormatDataReturn type from protocol, as it is also used in the api
export type { GetCredentialFormatDataReturn, DeleteCredentialOptions }

export type FindCredentialProposalMessageReturn<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]> =
  ReturnType<CPs[number]['findProposalMessage']>
export type FindCredentialOfferMessageReturn<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]> =
  ReturnType<CPs[number]['findOfferMessage']>
export type FindCredentialRequestMessageReturn<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]> =
  ReturnType<CPs[number]['findRequestMessage']>
export type FindCredentialMessageReturn<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]> =
  ReturnType<CPs[number]['findCredentialMessage']>

/**
 * Get the supported protocol versions based on the provided credential protocols.
 */
export type CredentialProtocolVersionType<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]> =
  CPs[number]['version']

interface BaseOptions {
  autoAcceptCredential?: DidCommAutoAcceptCredential
  comment?: string

  /**
   * Will be ignored for v1 protocol as it is not supported
   */
  goalCode?: string

  /**
   * Will be ignored for v1 protocol as it is not supported
   */
  goal?: string
}

/**
 * Interface for CredentialsApi.proposeCredential. Will send a proposal.
 */
export interface ProposeCredentialOptions<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]>
  extends BaseOptions {
  connectionId: string
  protocolVersion: CredentialProtocolVersionType<CPs>
  credentialFormats: DidCommCredentialFormatPayload<CredentialFormatsFromProtocols<CPs>, 'createProposal'>
}

/**
 * Interface for CredentialsApi.acceptProposal. Will send an offer
 *
 * credentialFormats is optional because this is an accept method
 */
export interface AcceptCredentialProposalOptions<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]>
  extends BaseOptions {
  credentialExchangeRecordId: string
  credentialFormats?: DidCommCredentialFormatPayload<CredentialFormatsFromProtocols<CPs>, 'acceptProposal'>
}

/**
 * Interface for CredentialsApi.negotiateProposal. Will send an offer
 */
export interface NegotiateCredentialProposalOptions<
  CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[],
> extends BaseOptions {
  credentialExchangeRecordId: string
  credentialFormats: DidCommCredentialFormatPayload<CredentialFormatsFromProtocols<CPs>, 'createOffer'>
}

/**
 * Interface for CredentialsApi.createOffer. Will create an out of band offer
 */
export interface CreateCredentialOfferOptions<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]>
  extends BaseOptions {
  protocolVersion: CredentialProtocolVersionType<CPs>
  credentialFormats: DidCommCredentialFormatPayload<CredentialFormatsFromProtocols<CPs>, 'createOffer'>
}

/**
 * Interface for CredentialsApi.offerCredential. Extends CreateCredentialOfferOptions, will send an offer
 */
export interface OfferCredentialOptions<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]>
  extends BaseOptions,
    CreateCredentialOfferOptions<CPs> {
  connectionId: string
}

/**
 * Interface for CredentialsApi.acceptOffer. Will send a request
 *
 * credentialFormats is optional because this is an accept method
 */
export interface AcceptCredentialOfferOptions<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]>
  extends BaseOptions {
  credentialExchangeRecordId: string
  credentialFormats?: DidCommCredentialFormatPayload<CredentialFormatsFromProtocols<CPs>, 'acceptOffer'>
}

/**
 * Interface for CredentialsApi.negotiateOffer. Will send a proposal.
 */
export interface NegotiateCredentialOfferOptions<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]>
  extends BaseOptions {
  credentialExchangeRecordId: string
  credentialFormats: DidCommCredentialFormatPayload<CredentialFormatsFromProtocols<CPs>, 'createProposal'>
}

/**
 * Interface for CredentialsApi.acceptRequest. Will send a credential
 *
 * credentialFormats is optional because this is an accept method
 */
export interface AcceptCredentialRequestOptions<CPs extends DidCommCredentialProtocol[] = DidCommCredentialProtocol[]>
  extends BaseOptions {
  credentialExchangeRecordId: string
  credentialFormats?: DidCommCredentialFormatPayload<CredentialFormatsFromProtocols<CPs>, 'acceptRequest'>
  autoAcceptCredential?: DidCommAutoAcceptCredential
  comment?: string
}

/**
 * Interface for CredentialsApi.acceptCredential. Will send an ack message
 */
export interface AcceptCredentialOptions {
  credentialExchangeRecordId: string
}

/**
 * Interface for CredentialsApi.sendRevocationNotification. Will send a revoke message
 */
export interface SendRevocationNotificationOptions {
  connectionId: string
  revocationId: string
  revocationFormat: string
  comment?: string
  requestAck?: boolean
}

/**
 * Interface for CredentialsApi.sendProblemReport. Will send a problem-report message
 */
export interface SendCredentialProblemReportOptions {
  credentialExchangeRecordId: string
  description: string
}

/**
 * Interface for CredentialsApi.declineOffer. Decline a received credential offer and optionally send a problem-report message to Issuer.
 */
export interface DeclineCredentialOfferOptions {
  credentialExchangeRecordId: string

  /**
   * Whether to send a problem-report message to the issuer as part
   * of declining the credential offer
   */
  sendProblemReport?: boolean

  /**
   * Description to include in the problem-report message
   * Only used if `sendProblemReport` is set to `true`.
   * @default "Offer declined"
   */
  problemReportDescription?: string
}
