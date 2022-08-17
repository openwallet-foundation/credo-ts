import type { ProofService } from './ProofService'
import type { ProofFormat, ProofFormatPayload } from './formats/ProofFormat'
import type { AutoAcceptProof } from './models'
import type { ProofConfig } from './models/ModuleOptions'

/**
 * Get the supported protocol versions based on the provided credential services.
 */
export type ProtocolVersionType<PSs extends ProofService[]> = PSs[number]['version']

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
}

export interface OutOfBandRequestOptions<
  PFs extends ProofFormat[] = ProofFormat[],
  PSs extends ProofService[] = ProofService[]
> {
  protocolVersion: ProtocolVersionType<PSs>
  proofFormats: ProofFormatPayload<PFs, 'createOutOfBandRequest'>
  comment?: string
  autoAcceptProof?: AutoAcceptProof
}
