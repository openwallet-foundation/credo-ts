import type { AgentContext } from '../../../agent'
import type { ProofFormat } from './ProofFormat'
import type {
  FormatCreateReturn,
  FormatProcessOptions,
  FormatCreateProposalOptions,
  FormatAcceptProposalOptions,
  FormatCreateRequestOptions,
  FormatAcceptRequestOptions,
  FormatGetCredentialsForRequestOptions,
  CredentialsForRequest,
  SelectedCredentialsForRequest,
} from './ProofFormatServiceOptions'

import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../utils'

/**
 * This abstract class is the base class for any proof format
 * specific service.
 *
 * @export
 * @abstract
 * @class ProofFormatService
 */
export abstract class ProofFormatService<PF extends ProofFormat = ProofFormat> {
  abstract readonly formatKey: PF['formatKey']

  // proposal methods
  abstract createProposal(
    agentContext: AgentContext,
    options: FormatCreateProposalOptions<PF>
  ): Promise<FormatCreateReturn>
  abstract processProposal(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>
  abstract acceptProposal(
    agentContext: AgentContext,
    options: FormatAcceptProposalOptions<PF>
  ): Promise<FormatCreateReturn>

  abstract createRequest(
    agentContext: AgentContext,
    options: FormatCreateRequestOptions<PF>
  ): Promise<FormatCreateReturn>
  abstract processRequest(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>
  abstract acceptRequest(
    agentContext: AgentContext,
    options: FormatAcceptRequestOptions<PF>
  ): Promise<FormatCreateReturn>

  abstract processPresentation(agentContext: AgentContext, options: FormatProcessOptions): Promise<boolean>

  abstract getCredentialsForRequest(
    agentContext: AgentContext,
    options: FormatGetCredentialsForRequestOptions<PF>
  ): Promise<CredentialsForRequest<PF>>

  abstract autoSelectCredentialsForRequest(
    agentContext: AgentContext,
    options: CredentialsForRequest<PF>
  ): Promise<SelectedCredentialsForRequest<PF>>

  // abstract proposalAndRequestAreEqual(
  //   proposalAttachments: ProofAttachmentFormat[],
  //   requestAttachments: ProofAttachmentFormat[]
  // ): boolean

  abstract supportsFormat(formatIdentifier: string): boolean

  /**
   * Returns an object of type {@link Attachment} for use in presentation exchange messages.
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
        base64: JsonEncoder.toBase64(data),
      }),
    })

    return attachment
  }
}
