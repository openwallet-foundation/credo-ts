/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CredentialRecord } from '../../..'
import type { AutoAcceptCredential } from '../../../CredentialAutoAcceptType'
import type { CredentialPreviewAttribute } from '../../../CredentialPreviewAttributes'
import type {
  AcceptProposalOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
  V2CredDefinitionFormat,
} from '../../../interfaces'
import type { V2CredentialPreview } from '../../V2CredentialPreview'
import type { V2IssueCredentialMessage } from '../../messages/V2IssueCredentialMessage'
import type { V2OfferCredentialMessage } from '../../messages/V2OfferCredentialMessage'
import type { V2ProposeCredentialMessage } from '../../messages/V2ProposeCredentialMessage'
import type { V2RequestCredentialMessage } from '../../messages/V2RequestCredentialMessage'
import type {
  V2AttachmentFormats,
  V2CredProposeOfferRequestFormat,
} from '../CredentialFormatService'
import type { MetaDataService } from '../MetaDataService'
import type { V2CredentialFormatSpec } from '../V2CredentialFormat'
import type { AgentConfig } from '@aries-framework/core'
import type { CredOffer, CredReq } from 'indy-sdk'

import { Attachment, AttachmentData } from '../../../../../../src/decorators/attachment/Attachment'
import { CredentialFormatService } from '../CredentialFormatService'
import { ATTACHMENT_FORMAT } from '../V2CredentialFormat'

import { JsonLdMetaDataService } from './JsonLdMetaDataService'


export class JsonLdCredentialFormatService extends CredentialFormatService {
  public shouldAutoRespondToOffer(credentialRecord: CredentialRecord, autoAcceptType: AutoAcceptCredential): boolean {
    throw new Error('Method not implemented.')
  }
  public shouldAutoRespondToRequest(credentialRecord: CredentialRecord, autoAcceptType: AutoAcceptCredential): boolean {
    throw new Error('Method not implemented.')
  }
  public shouldAutoRespondToIssue(credentialRecord: CredentialRecord, autoAcceptType: AutoAcceptCredential): boolean {
    throw new Error('Method not implemented.')
  }
  public shouldAutoRespondToProposal(credentialRecord: CredentialRecord, autoAcceptType: AutoAcceptCredential): boolean {
    throw new Error('Method not implemented.')
  }
 
  public processCredential(message: V2IssueCredentialMessage, credentialRecord: CredentialRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public createRequestAttachFormats(requestOptions: RequestCredentialOptions, credentialRecord: CredentialRecord): Promise<V2AttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  public getAttachment(
    message: V2RequestCredentialMessage | V2ProposeCredentialMessage | V2OfferCredentialMessage
  ): Attachment | undefined {
    throw new Error('Method not implemented.')
  }
  // eslint-disable-next-line prettier/prettier
  public createIssueAttachFormats(credentialRecord: CredentialRecord): Promise<V2AttachmentFormats> {
    throw new Error('Method not implemented.')
  }
  public processProposal(options: AcceptProposalOptions, credentialRecord: CredentialRecord): AcceptProposalOptions {
    throw new Error('Method not implemented.')
  }
  public getFormatData(data: unknown, id: string): Attachment {
    throw new Error('Method not implemented.')
  }
  public getCredentialRequest(data: AttachmentData): V2CredProposeOfferRequestFormat | undefined {
    throw new Error('Method not implemented.')
  }
  public getMetaDataService(): MetaDataService {
    return new JsonLdMetaDataService()
  }
  public setMetaDataAndEmitEventForOffer(
    proposal: V2CredProposeOfferRequestFormat,
    credentialRecord: CredentialRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForRequest(request: V2CredProposeOfferRequestFormat, credentialRecord: CredentialRecord): void {
    throw new Error('Method not implemented.')
  }
  public getCredentialPayload<T extends CredOffer | CredReq>(data: AttachmentData): V2CredProposeOfferRequestFormat {
    throw new Error('Method not implemented.')
  }

  public setPreview(_proposal: AcceptProposalOptions, _preview?: V2CredentialPreview): AcceptProposalOptions {
    throw new Error('Method not implemented.')
  }

  public setMetaDataAndEmitEventForProposal(
    _proposal: V2CredProposeOfferRequestFormat,
    _credentialRecord: CredentialRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForOffer(_offer: V2CredProposeOfferRequestFormat, _credentialRecord: CredentialRecord): void {
    throw new Error('Method not implemented.')
  }
  public createOffer(_proposal: AcceptProposalOptions): Promise<V2CredProposeOfferRequestFormat> {
    throw new Error('Method not implemented.')
  }
  public createOfferAttachFormats(
    proposal: AcceptProposalOptions,
    offer: V2CredProposeOfferRequestFormat,
    messageType: string
  ): V2AttachmentFormats {
    throw new Error('Method not implemented.')
  }
  public getCredentialAttributes(_proposal: ProposeCredentialOptions): CredentialPreviewAttribute[] | undefined {
    throw new Error('Method not implemented.')
  }
  public setMetaDataAndEmitEvent(
    _proposal: ProposeCredentialOptions,
    _credentialRecord: CredentialRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public createProposalAttachFormats(_proposal: ProposeCredentialOptions, _messageType: string): V2AttachmentFormats {
    // implementation for test purposes only
    const formats = ATTACHMENT_FORMAT['CRED_20_PROPOSAL'].ldproof
    const filtersAttach: Attachment = new Attachment({
      id: '',
      mimeType: 'application/json',
      data: new AttachmentData({
        base64: '',
      }),
    })
    return { formats, filtersAttach }
  }
  public getFormatIdentifier(_messageType: string): V2CredentialFormatSpec {
    throw new Error('Method not implemented.')
  }
  public getCredentialDefinition(offer: V2CredProposeOfferRequestFormat): Promise<V2CredDefinitionFormat | undefined> {
    throw new Error('Method not implemented.')
  }
  public createRequest(options: RequestCredentialOptions): Promise<V2CredProposeOfferRequestFormat> {
    throw new Error('Method not implemented.')
  }
}
