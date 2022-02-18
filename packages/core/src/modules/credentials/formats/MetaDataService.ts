import type { CredentialExchangeRecord } from '..'
import type { CredProposeOfferRequestFormat } from './CredentialFormatService'

export interface MetaDataService {
  setMetaDataForProposal(
    proposal: CredProposeOfferRequestFormat,
    credentialRecord: CredentialExchangeRecord
  ): Promise<void>
  setMetaDataForOffer(offer: CredProposeOfferRequestFormat, credentialRecord: CredentialExchangeRecord): void
  setMetaDataForRequest(request: CredProposeOfferRequestFormat, credentialRecord: CredentialExchangeRecord): void
}
