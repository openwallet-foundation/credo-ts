/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { AgentMessage } from '../../../../../src/agent/AgentMessage'
import type { Attachment } from '../../../../decorators/attachment/Attachment'
import type {
  AcceptCredentialOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../interfaces'
import type { CredentialExchangeRecord } from '../../repository/CredentialRecord'
import type {
  CredentialAttachmentFormats,
  CredentialFormatSpec,
  HandlerAutoAcceptOptions,
  OfferAttachmentFormats,
} from '../models/CredentialFormatServiceOptions'

import { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import { CredentialResponseCoordinator } from '../../CredentialResponseCoordinator'
import { CredentialFormatService } from '../CredentialFormatService'

export class JsonLdCredentialFormatService extends CredentialFormatService {
  public async processProposal(
    options: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<AcceptProposalOptions> {
    // no meta data set for ld proofs
    return options
  }

  createOffer(options: AcceptProposalOptions): Promise<OfferAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  createRequest(
    options: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  createCredential(
    options: AcceptRequestOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
  }

  public shouldAutoRespondToProposal(options: HandlerAutoAcceptOptions): boolean {
    const autoAccept = CredentialResponseCoordinator.composeAutoAccept(
      options.credentialRecord.autoAcceptCredential,
      options.autoAcceptType
    )
    if (autoAccept === AutoAcceptCredential.Always) {
      return true
    }
    return false
  }

  shouldAutoRespondToRequest(options: HandlerAutoAcceptOptions): boolean {
    throw new Error('Method not implemented.')
  }
  shouldAutoRespondToCredential(options: HandlerAutoAcceptOptions): boolean {
    throw new Error('Method not implemented.')
  }
  processOffer(options: AcceptProposalOptions, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }
  processCredential(options: AcceptCredentialOptions, credentialRecord: CredentialExchangeRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  processRequest(options: RequestCredentialOptions, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }

  public createProposal(options: ProposeCredentialOptions): CredentialAttachmentFormats {
    const format: CredentialFormatSpec = {
      attachId: 'ld_proof',
      format: 'aries/ld-proof-vc-detail@v1.0',
    }

    const attachment: Attachment = this.getFormatData(options.credentialFormats.jsonld, format.attachId)

    // For now we will not handle linked attachments in the W3C credential. So the credentialProposal array
    // should just contain standard crede

    return { format, attachment }
  }
}
