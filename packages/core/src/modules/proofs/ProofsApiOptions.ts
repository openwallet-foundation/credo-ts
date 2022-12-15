import type { ProofService } from './ProofService'
import type { ProofFormat, ProofFormatPayload } from './formats/ProofFormat'
import type { AutoAcceptProof } from './models'
import type { ProofConfig } from './models/ModuleOptions'

/**
 * Get the supported protocol versions based on the provided proof services.
 */
export type ProofsProtocolVersionType<PSs extends ProofService[]> = PSs[number]['version']
export type FindProofProposalMessageReturn<PSs extends ProofService[]> = ReturnType<PSs[number]['findProposalMessage']>
export type FindProofRequestMessageReturn<PSs extends ProofService[]> = ReturnType<PSs[number]['findRequestMessage']>
export type FindProofPresentationMessageReturn<PSs extends ProofService[]> = ReturnType<
  PSs[number]['findPresentationMessage']
>

/**
 * Get the service map for usage in the proofs module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type ServiceMap = ProofServiceMap<[IndyProofFormat], [V1ProofService]>
 *
 * // equal to
 * type ServiceMap = {
 *   v1: V1ProofService
 * }
 * ```
 */
export type ProofServiceMap<PFs extends ProofFormat[], PSs extends ProofService<PFs>[]> = {
  [PS in PSs[number] as PS['version']]: ProofService<PFs>
}

export interface ProposeProofOptions<
  PFs extends ProofFormat[] = ProofFormat[],
  PSs extends ProofService[] = ProofService[]
> {
  connectionId: string
  protocolVersion: ProofsProtocolVersionType<PSs>
  proofFormats: ProofFormatPayload<PFs, 'createProposal'>
  comment?: string
  goalCode?: string
  autoAcceptProof?: AutoAcceptProof
  parentThreadId?: string
}

export interface NegotiateRequestOptions<PFs extends ProofFormat[] = ProofFormat[]> {
  proofRecordId: string
  proofFormats: ProofFormatPayload<PFs, 'createProposalAsResponse'>
  comment?: string
  goalCode?: string
  autoAcceptProof?: AutoAcceptProof
}

export interface AcceptProofPresentationOptions<PFs extends ProofFormat[] = ProofFormat[]> {
  proofRecordId: string
  comment?: string
  proofFormats: ProofFormatPayload<PFs, 'createPresentation'>
}

export interface AcceptProofProposalOptions {
  proofRecordId: string
  config?: ProofConfig
  goalCode?: string
  willConfirm?: boolean
  comment?: string
}

export interface RequestProofOptions<
  PFs extends ProofFormat[] = ProofFormat[],
  PSs extends ProofService[] = ProofService[]
> {
  protocolVersion: ProofsProtocolVersionType<PSs>
  connectionId: string
  proofFormats: ProofFormatPayload<PFs, 'createRequest'>
  comment?: string
  autoAcceptProof?: AutoAcceptProof
  parentThreadId?: string
}

export interface NegotiateProposalOptions<PFs extends ProofFormat[] = ProofFormat[]> {
  proofRecordId: string
  proofFormats: ProofFormatPayload<PFs, 'createRequestAsResponse'>
  comment?: string
  autoAcceptProof?: AutoAcceptProof
  parentThreadId?: string
}

export interface CreateProofRequestOptions<
  PFs extends ProofFormat[] = ProofFormat[],
  PSs extends ProofService[] = ProofService[]
> {
  protocolVersion: ProofsProtocolVersionType<PSs>
  proofFormats: ProofFormatPayload<PFs, 'createRequest'>
  comment?: string
  autoAcceptProof?: AutoAcceptProof
  parentThreadId?: string
}
