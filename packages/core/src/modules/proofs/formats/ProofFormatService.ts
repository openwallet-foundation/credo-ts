import type { ProofAttachmentFormat } from './models/ProofAttachmentFormat'
import type {
  CreatePresentationOptions,
  CreateProposalOptions,
  CreateRequestOptions,
  ProcessPresentationOptions,
  ProcessProposalOptions,
  ProcessRequestOptions,
  VerifyProofOptions,
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
  abstract createProposal(options: CreateProposalOptions): ProofAttachmentFormat

  abstract processProposal(options: ProcessProposalOptions): void

  abstract createRequest(options: CreateRequestOptions): ProofAttachmentFormat

  abstract processRequest(options: ProcessRequestOptions): void

  abstract createPresentation(options: CreatePresentationOptions): Promise<ProofAttachmentFormat>

  abstract processPresentation(options: ProcessPresentationOptions): Promise<boolean>

  // private abstract verifyProof(options: VerifyProofOptions): Promise<boolean>

  abstract supportsFormat(formatIdentifier: string): boolean

  // abstract getRequestedCredentialsForProofRequest(record: ProofRecord):
}
