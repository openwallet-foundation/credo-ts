/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CredentialExchangeRecord } from '../../../../repository'
import type { V2CredProposalFormat, V2CredProposeOfferRequestFormat } from '../CredentialFormatService'
import type { MetaDataService } from '../MetaDataService'

export class JsonLdMetaDataService implements MetaDataService {
  public setMetaDataForRequest(
    request: V2CredProposeOfferRequestFormat,
    credentialRecord: CredentialExchangeRecord
  ): void {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForProposal(
    proposal: V2CredProposeOfferRequestFormat,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void> {
    throw new Error('Method not implemented.')
  }
  public setMetaDataForOffer(offer: V2CredProposeOfferRequestFormat, credentialRecord: CredentialExchangeRecord): void {
    throw new Error('Method not implemented.')
  }
}
