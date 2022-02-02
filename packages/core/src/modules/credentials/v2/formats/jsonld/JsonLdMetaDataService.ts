/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CredentialRecord } from '../../../repository'
import type { V2CredProposalFormat, V2CredProposeOfferRequestFormat } from '../CredentialFormatService'
import type { MetaDataService } from '../MetaDataService'

export class JsonLdMetaDataService implements MetaDataService {
  public setMetaDataForProposal(
    proposal: V2CredProposeOfferRequestFormat,
    credentialRecord: CredentialRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }

  public setMetaDataAndEmitEventForOffer(
    proposal: V2CredProposeOfferRequestFormat,
    credentialRecord: CredentialRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForOffer(offer: V2CredProposeOfferRequestFormat, credentialRecord: CredentialRecord): void {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForRequest(request: V2CredProposeOfferRequestFormat, credentialRecord: CredentialRecord): void {
    throw new Error('Method not implemented.')
  }
}
