/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CredentialExchangeRecord } from '../../repository'
import type { V2CredProposalFormat, CredProposeOfferRequestFormat } from '../CredentialFormatService'
import type { MetaDataService } from '../MetaDataService'

export class JsonLdMetaDataService implements MetaDataService {
  public setMetaDataForRequest(
    request: CredProposeOfferRequestFormat,
    credentialRecord: CredentialExchangeRecord
  ): void {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForProposal(
    proposal: CredProposeOfferRequestFormat,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForOffer(offer: CredProposeOfferRequestFormat, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }
}
