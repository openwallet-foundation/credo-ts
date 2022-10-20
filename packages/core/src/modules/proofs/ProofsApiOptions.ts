import type { ProofService } from './ProofService'
import type { ProofFormat, ProofFormatPayload } from './formats/ProofFormat'
import type { AutoAcceptProof } from './models'
import type { ProofConfig } from './models/ModuleOptions'

/**
 * Get the supported protocol versions based on the provided proof services.
 */
export type ProtocolVersionType<PSs extends ProofService[]> = PSs[number]['version']
export type FindProposalMessageReturn<PSs extends ProofService[]> = ReturnType<PSs[number]['findProposalMessage']>
export type FindRequestMessageReturn<PSs extends ProofService[]> = ReturnType<PSs[number]['findRequestMessage']>
export type FindPresentationMessageReturn<PSs extends ProofService[]> = ReturnType<
  PSs[number]['findPresentationMessage']
>

/**
 * Get the service map for usage in the proofs module. Will return a type mapping of protocol version to service.
 *
 * @example
 * ```
 * type ProofServiceMap = ServiceMap<[IndyProofFormat], [V1ProofService]>
 *
 * // equal to
 * type ProofServiceMap = {
 *   v1: V1ProofService
 * }
 * ```
 */
export type ServiceMap<PFs extends ProofFormat[], PSs extends ProofService<PFs>[]> = {
  [PS in PSs[number] as PS['version']]: ProofService<PFs>
}

export interface ProposeProofOptions<
  PFs extends ProofFormat[] = ProofFormat[],
  PSs extends ProofService[] = ProofService[]
> {
  connectionId: string
  protocolVersion: ProtocolVersionType<PSs>
  proofFormats: ProofFormatPayload<PFs, 'createProposal'>
  comment?: string
  goalCode?: string
  autoAcceptProof?: AutoAcceptProof
  parentThreadId?: string
}
export interface AcceptPresentationOptions<PFs extends ProofFormat[] = ProofFormat[]> {
  proofRecordId: string
  comment?: string
  proofFormats: ProofFormatPayload<PFs, 'createPresentation'>
}

export interface AcceptProposalOptions {
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
  protocolVersion: ProtocolVersionType<PSs>
  connectionId: string
  proofFormats: ProofFormatPayload<PFs, 'createRequest'>
  comment?: string
  autoAcceptProof?: AutoAcceptProof
  parentThreadId?: string
}

export interface CreateProofRequestOptions<
  PFs extends ProofFormat[] = ProofFormat[],
  PSs extends ProofService[] = ProofService[]
> {
  protocolVersion: ProtocolVersionType<PSs>
  proofFormats: ProofFormatPayload<PFs, 'createRequest'>
  comment?: string
  autoAcceptProof?: AutoAcceptProof
  parentThreadId?: string
}
