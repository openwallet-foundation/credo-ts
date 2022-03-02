/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/adjacent-overload-signatures */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CredentialExchangeRecord } from '../..'
import type { AutoAcceptCredential } from '../../CredentialAutoAcceptType'
import type {
  AcceptOfferOptions,
  AcceptProposalOptions,
  AcceptRequestOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
} from '../../interfaces'
import type { CredentialPreviewAttribute } from '../../models/CredentialPreviewAttributes'
import type { V2CredentialPreview } from '../../protocol/v2/V2CredentialPreview'
import type { V2IssueCredentialMessage } from '../../protocol/v2/messages/V2IssueCredentialMessage'
import type { V2OfferCredentialMessage } from '../../protocol/v2/messages/V2OfferCredentialMessage'
import type { V2ProposeCredentialMessage } from '../../protocol/v2/messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessage } from '../../protocol/v2/messages/V2RequestCredentialMessage'
import type {
  CredentialAttachmentFormats,
  CredentialDefinitionFormat,
  CredentialFormatSpec,
  CredProposeOfferRequestFormat,
  OfferAttachmentFormats,
} from '../models/CredentialFormatServiceOptions'
import type { CredOffer, CredReq } from 'indy-sdk'

import { Attachment, AttachmentData } from '../../../../decorators/attachment/Attachment'
import { CredentialFormatService } from '../CredentialFormatService'

export class JsonLdCredentialFormatService extends CredentialFormatService {
  processRequest(options: RequestCredentialOptions, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }

  public shouldAutoRespondToProposal(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    proposeMessageAttributes?: CredentialPreviewAttribute[],
    proposePayload?: CredProposeOfferRequestFormat,
    offerPayload?: CredProposeOfferRequestFormat
  ): boolean {
    throw new Error('Method not implemented.')
  }
  public shouldAutoRespondToOffer(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    offerPayload?: CredProposeOfferRequestFormat,
    offerMessageAttributes?: CredentialPreviewAttribute[],
    proposePayload?: CredProposeOfferRequestFormat
  ): boolean {
    throw new Error('Method not implemented.')
  }
  public shouldAutoRespondToRequest(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    requestPayload?: CredProposeOfferRequestFormat,
    offerPayload?: CredProposeOfferRequestFormat,
    proposePayload?: CredProposeOfferRequestFormat
  ): boolean {
    throw new Error('Method not implemented.')
  }
  public shouldAutoRespondToCredential(
    credentialRecord: CredentialExchangeRecord,
    autoAcceptType: AutoAcceptCredential,
    credentialPayload?: CredProposeOfferRequestFormat
  ): boolean {
    throw new Error('Method not implemented.')
  }

  public processCredential(
    message: V2IssueCredentialMessage,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public createRequest(
    requestOptions: RequestCredentialOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  public getAttachment(
    message: V2RequestCredentialMessage | V2ProposeCredentialMessage | V2OfferCredentialMessage
  ): Attachment | undefined {
    throw new Error('Method not implemented.')
  }
  // eslint-disable-next-line prettier/prettier
  public createCredential(
    options: AcceptRequestOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<CredentialAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  public processProposal(
    options: AcceptProposalOptions,
    credentialRecord: CredentialExchangeRecord
  ): Promise<AcceptProposalOptions> {
    throw new Error('Method not implemented.')
  }
  public getFormatData(data: unknown, id: string): Attachment {
    throw new Error('Method not implemented.')
  }
  public getCredentialRequest(data: AttachmentData): CredProposeOfferRequestFormat | undefined {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForRequest(
    request: CredProposeOfferRequestFormat,
    credentialRecord: CredentialExchangeRecord
  ): void {
    throw new Error('Method not implemented.')
  }
  public getCredentialPayload<T extends CredOffer | CredReq>(data: Attachment): CredProposeOfferRequestFormat {
    throw new Error('Method not implemented.')
  }

  public setPreview(_proposal: AcceptProposalOptions, _preview?: V2CredentialPreview): AcceptProposalOptions {
    throw new Error('Method not implemented.')
  }

  public setMetaDataAndEmitEventForProposal(
    _proposal: CredProposeOfferRequestFormat,
    _credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForOffer(_offer: CredProposeOfferRequestFormat, _credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }

  public createOffer(proposal: AcceptProposalOptions): Promise<OfferAttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  public getCredentialAttributes(_proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined {
    throw new Error('Method not implemented.')
  }

  public createProposal(proposal: ProposeCredentialOptions): CredentialAttachmentFormats {
    // implementation for test purposes only
    const format: CredentialFormatSpec = {
      attachId: this.generateId(),
      format: 'aries/ld-proof-vc-detail@v1.0',
    }
    const attachment: Attachment = new Attachment({
      id: '',
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: '',
      }),
    })
    return { format, attachment }
  }
}
