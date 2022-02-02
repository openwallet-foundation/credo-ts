import type { CredentialRecord } from '../..'
import type { V2CredProposeOfferRequestFormat } from './CredentialFormatService'

export interface MetaDataService {
  setMetaDataForProposal(proposal: V2CredProposeOfferRequestFormat, credentialRecord: CredentialRecord): Promise<void>
  setMetaDataForOffer(offer: V2CredProposeOfferRequestFormat, credentialRecord: CredentialRecord): void
  setMetaDataForRequest(request: V2CredProposeOfferRequestFormat, credentialRecord: CredentialRecord): void
}
