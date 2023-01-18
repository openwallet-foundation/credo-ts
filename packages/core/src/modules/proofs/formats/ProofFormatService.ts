import type { ProofAttachmentFormat } from './ProofAttachmentFormat'
import type { ProofFormat } from './ProofFormat'
import type {
  FormatCreatePresentationOptions,
  FormatCreateProofProposalOptions,
  FormatCreateProofRequestOptions,
  FormatGetRequestedCredentials,
  FormatPresentationAttachment,
  FormatProcessPresentationOptions,
  FormatProcessProposalOptions,
  FormatProcessRequestOptions,
  FormatProofRequestOptions,
} from './ProofFormatServiceOptions'
import type { AgentContext } from '../../../agent'
import type { AgentConfig } from '../../../agent/AgentConfig'
import type { DidCommMessageRepository } from '../../../storage'
import type {
  CreateRequestAsResponseOptions,
  RequestedCredentialReturn,
  RetrievedCredentialOptions,
} from '../ProofServiceOptions'

import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { JsonTransformer } from '../../../utils/JsonTransformer'

/**
 * This abstract class is the base class for any proof format
 * specific service.
 *
 * @export
 * @abstract
 * @class ProofFormatService
 */
export abstract class ProofFormatService<PF extends ProofFormat = ProofFormat> {
  protected didCommMessageRepository: DidCommMessageRepository
  protected agentConfig: AgentConfig

  public abstract readonly formatKey: PF['formatKey']

  public constructor(didCommMessageRepository: DidCommMessageRepository, agentConfig: AgentConfig) {
    this.didCommMessageRepository = didCommMessageRepository
    this.agentConfig = agentConfig
  }

  public abstract createProposal(options: FormatCreateProofProposalOptions): Promise<ProofAttachmentFormat>

  public abstract processProposal(options: FormatProcessProposalOptions): Promise<void>

  public abstract createRequest(options: FormatCreateProofRequestOptions): Promise<ProofAttachmentFormat>

  public abstract processRequest(options: FormatProcessRequestOptions): Promise<void>

  public abstract createPresentation(
    agentContext: AgentContext,
    options: FormatCreatePresentationOptions<PF>
  ): Promise<ProofAttachmentFormat>

  public abstract processPresentation(
    agentContext: AgentContext,
    options: FormatProcessPresentationOptions
  ): Promise<boolean>

  public abstract createProofRequestFromProposal(
    options: FormatPresentationAttachment
  ): Promise<FormatProofRequestOptions>

  public abstract getRequestedCredentialsForProofRequest(
    agentContext: AgentContext,
    options: FormatGetRequestedCredentials
  ): Promise<RetrievedCredentialOptions<[PF]>>

  public abstract autoSelectCredentialsForProofRequest(
    options: RetrievedCredentialOptions<[PF]>
  ): Promise<RequestedCredentialReturn<[PF]>>

  public abstract proposalAndRequestAreEqual(
    proposalAttachments: ProofAttachmentFormat[],
    requestAttachments: ProofAttachmentFormat[]
  ): boolean

  public abstract supportsFormat(formatIdentifier: string): boolean

  public abstract createRequestAsResponse(options: CreateRequestAsResponseOptions<[PF]>): Promise<ProofAttachmentFormat>

  /**
   * Returns an object of type {@link Attachment} for use in proof exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   */
  protected getFormatData(data: unknown, id: string): Attachment {
    const attachment = new Attachment({
      id,
      mimeType: 'application/json',
      data: new AttachmentData({
        json: JsonTransformer.toJSON(data),
      }),
    })

    return attachment
  }
}
