/* eslint-disable @typescript-eslint/explicit-member-accessibility */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CredentialRecord } from '../../..'
import type { CredentialPreviewAttribute } from '../../../CredentialPreviewAttributes'
import type { V2CredentialPreview } from '../../V2CredentialPreview'
import type {
  AcceptProposalOptions,
  ProposeCredentialOptions,
  RequestCredentialOptions,
  V2CredDefinitionFormat,
  V2CredOfferFormat,
  V2CredProposalFormat,
  V2CredRequestFormat,
} from '../../interfaces'
import type { V2OfferCredentialMessage } from '../../messages/V2OfferCredentialMessage'
import type { V2RequestCredentialMessage } from '../../messages/V2RequestCredentialMessage'
import type { V2AttachmentFormats } from '../CredentialFormatService'
import type { V2CredentialFormatSpec } from '../V2CredentialFormat'
import type { Attachment } from 'packages/core/src/decorators/attachment/Attachment'

import { CredentialFormatService } from '../CredentialFormatService'

export class JsonLdCredentialFormatService extends CredentialFormatService {
  setMetaDataAndEmitEventForOffer(proposal: V2CredOfferFormat, credentialRecord: CredentialRecord): Promise<void> {
    throw new Error('Method not implemented.')
  }
  createAcceptProposalOptions(credentialRecord: CredentialRecord): AcceptProposalOptions {
    throw new Error('Method not implemented.')
  }
  public getCredentialRequest(message: V2RequestCredentialMessage): V2CredRequestFormat | undefined {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForRequest(request: V2CredRequestFormat, credentialRecord: CredentialRecord): void {
    throw new Error('Method not implemented.')
  }
  public getCredentialRequestAttachFormats(request: V2CredRequestFormat, messageType: string): V2AttachmentFormats {
    throw new Error('Method not implemented.')
  }
  public getCredentialOffer(record: CredentialRecord): V2CredOfferFormat | undefined {
    throw new Error('Method not implemented.')
  }

  public setPreview(_proposal: AcceptProposalOptions, _preview?: V2CredentialPreview): AcceptProposalOptions {
    throw new Error('Method not implemented.')
  }
  public getCredentialLinkedAttachments(_proposal: ProposeCredentialOptions): {
    attachments: Attachment[] | undefined
    previewWithAttachments: V2CredentialPreview
  } {
    throw new Error('Method not implemented.')
  }
  public setMetaDataAndEmitEventForProposal(
    _proposal: V2CredProposalFormat,
    _credentialRecord: CredentialRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public getFormatData(_data: V2CredOfferFormat | V2CredProposalFormat): Attachment[] {
    throw new Error('Method not implemented.')
  }
  public getCredentialOfferMessage(_credentialOfferMessage: V2OfferCredentialMessage): V2CredOfferFormat {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForOffer(_offer: V2CredOfferFormat, _credentialRecord: CredentialRecord): void {
    throw new Error('Method not implemented.')
  }
  public createCredentialOffer(_proposal: AcceptProposalOptions): Promise<V2CredOfferFormat> {
    throw new Error('Method not implemented.')
  }
  public getCredentialOfferAttachFormats(
    proposal: AcceptProposalOptions,
    offer: V2CredOfferFormat,
    messageType: string
  ): V2AttachmentFormats {
    throw new Error('Method not implemented.')
  }
  public getCredentialDefinitionId(_proposal: ProposeCredentialOptions): string | undefined {
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
  public getCredentialProposeAttachFormats(
    _proposal: ProposeCredentialOptions,
    _messageType: string
  ): V2AttachmentFormats {
    throw new Error('Method not implemented.')
  }
  public getFormatIdentifier(_messageType: string): V2CredentialFormatSpec {
    throw new Error('Method not implemented.')
  }
  public getCredentialDefinition(offer: V2CredOfferFormat): Promise<V2CredDefinitionFormat | undefined> {
    throw new Error('Method not implemented.')
  }
  public createCredentialRequest(options: RequestCredentialOptions): Promise<V2CredRequestFormat> {
    throw new Error('Method not implemented.')
  }
}
