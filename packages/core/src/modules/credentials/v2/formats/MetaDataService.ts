import type { CredentialExchangeRecord } from '../..'
import type { V2CredProposeOfferRequestFormat } from './CredentialFormatService'

export interface MetaDataService {
  setMetaDataForProposal(
    proposal: V2CredProposeOfferRequestFormat,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void>
  setMetaDataForOffer(offer: V2CredProposeOfferRequestFormat, credentialRecord: CredentialExchangeRecord): void
  setMetaDataForRequest(request: V2CredProposeOfferRequestFormat, credentialRecord: CredentialExchangeRecord): void
}
