import type { ProofRecord, GetRequestedCredentialsConfig, RetrievedCredentials, RequestedCredentials } from '..'
import type { DidCommMessageRepository } from '../../../storage'
import type { ProofAttachmentFormat } from './models/ProofAttachmentFormat'
import type {
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
  ProcessRequestOptions,
} from './models/ProofFormatServiceOptions'

/**
 * This abstract class is the base class for any proof format
 * specific service.
 *
 * @export
 * @abstract
 * @class ProofFormatService
 */
export abstract class ProofFormatService {
  protected didCommMessageRepository: DidCommMessageRepository

  public constructor(didCommMessageRepository: DidCommMessageRepository) {
    this.didCommMessageRepository = didCommMessageRepository
  }

  abstract createProposal(options: CreateProposalOptions): ProofAttachmentFormat

  abstract processProposal(options: ProcessProposalOptions): void

  abstract createRequest(options: CreateRequestOptions): ProofAttachmentFormat

  abstract processRequest(options: ProcessRequestOptions): void

  abstract createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat>

  abstract processPresentation(options: ProcessPresentationOptions): Promise<boolean>

  public abstract getRequestedCredentialsForProofRequest(options: {
    proofRecord: ProofRecord
    config: {
      indy?: GetRequestedCredentialsConfig
      jsonLd?: never
    }
  }): Promise<{
    indy?: RetrievedCredentials
    jsonLd?: never
  }>

  public abstract autoSelectCredentialsForProofRequest(options: {
    indy?: RetrievedCredentials
    jsonLd?: never
  }): Promise<{
    indy?: RequestedCredentials
    jsonLd?: never
  }>

  abstract proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean

  abstract supportsFormat(formatIdentifier: string): boolean

  // abstract getRequestedCredentialsForProofRequest(record: ProofRecord):
}
