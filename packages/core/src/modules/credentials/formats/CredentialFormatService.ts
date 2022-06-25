import type { AgentContext } from '../../../agent'
import type { EventEmitter } from '../../../agent/EventEmitter'
import type { CredentialRepository } from '../repository'
import type { CredentialFormat } from './CredentialFormat'
import type {
  FormatCreateProposalOptions,
  FormatCreateProposalReturn,
  FormatProcessOptions,
  FormatCreateOfferOptions,
  FormatCreateOfferReturn,
  FormatCreateRequestOptions,
  FormatCreateReturn,
  FormatAcceptRequestOptions,
  FormatAcceptOfferOptions,
  FormatAcceptProposalOptions,
  FormatAutoRespondCredentialOptions,
  FormatAutoRespondOfferOptions,
  FormatAutoRespondProposalOptions,
  FormatAutoRespondRequestOptions,
} from './CredentialFormatServiceOptions'

import { Attachment, AttachmentData } from '../../../decorators/attachment/Attachment'
import { JsonEncoder } from '../../../utils/JsonEncoder'

export abstract class CredentialFormatService<CF extends CredentialFormat = CredentialFormat> {
  protected credentialRepository: CredentialRepository
  protected eventEmitter: EventEmitter

  public constructor(credentialRepository: CredentialRepository, eventEmitter: EventEmitter) {
    this.credentialRepository = credentialRepository
    this.eventEmitter = eventEmitter
  }

  abstract readonly formatKey: CF['formatKey']
  abstract readonly credentialRecordType: CF['credentialRecordType']

  // proposal methods
  abstract createProposal(
    agentContext: AgentContext,
    options: FormatCreateProposalOptions<CF>
  ): Promise<FormatCreateProposalReturn>
  abstract processProposal(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>
  abstract acceptProposal(
    agentContext: AgentContext,
    options: FormatAcceptProposalOptions<CF>
  ): Promise<FormatCreateOfferReturn>

  // offer methods
  abstract createOffer(
    agentContext: AgentContext,
    options: FormatCreateOfferOptions<CF>
  ): Promise<FormatCreateOfferReturn>
  abstract processOffer(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>
  abstract acceptOffer(agentContext: AgentContext, options: FormatAcceptOfferOptions<CF>): Promise<FormatCreateReturn>

  // request methods
  abstract createRequest(
    agentContext: AgentContext,
    options: FormatCreateRequestOptions<CF>
  ): Promise<FormatCreateReturn>
  abstract processRequest(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>
  abstract acceptRequest(
    agentContext: AgentContext,
    options: FormatAcceptRequestOptions<CF>
  ): Promise<FormatCreateReturn>

  // credential methods
  abstract processCredential(agentContext: AgentContext, options: FormatProcessOptions): Promise<void>

  // auto accept methods
  abstract shouldAutoRespondToProposal(agentContext: AgentContext, options: FormatAutoRespondProposalOptions): boolean
  abstract shouldAutoRespondToOffer(agentContext: AgentContext, options: FormatAutoRespondOfferOptions): boolean
  abstract shouldAutoRespondToRequest(agentContext: AgentContext, options: FormatAutoRespondRequestOptions): boolean
  abstract shouldAutoRespondToCredential(
    agentContext: AgentContext,
    options: FormatAutoRespondCredentialOptions
  ): boolean

  abstract deleteCredentialById(agentContext: AgentContext, credentialId: string): Promise<void>

  abstract supportsFormat(format: string): boolean

  /**
   * Returns an object of type {@link Attachment} for use in credential exchange messages.
   * It looks up the correct format identifier and encodes the data as a base64 attachment.
   *
   * @param data The data to include in the attach object
   * @param id the attach id from the formats component of the message
   * @returns attachment to the credential proposal
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
