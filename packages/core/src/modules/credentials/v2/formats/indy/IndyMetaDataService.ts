import type { CredentialStateChangedEvent } from '../../..'
import type { EventEmitter } from '../../../../../agent/EventEmitter'
import type { CredPropose } from '../../../interfaces'
import type { CredentialRecord, CredentialRepository } from '../../../repository'
import type { V2CredProposalFormat, V2CredProposeOfferRequestFormat } from '../CredentialFormatService'
import type { MetaDataService } from '../MetaDataService'
import type { CredOffer } from 'indy-sdk'

import { CredentialEventTypes } from '../../..'
import { CredentialMetadataKeys } from '../../../repository'

export class IndyMetaDataService implements MetaDataService {
  protected credentialRepository: CredentialRepository // protected as in base class
  private eventEmitter: EventEmitter

  public constructor(credentialRepository: CredentialRepository, eventEmitter: EventEmitter) {
    this.eventEmitter = eventEmitter
    this.credentialRepository = credentialRepository
  }
  /**
   * Save the meta data and emit event for a credential offer
   * @param proposal wrapper object that contains either indy or some other format of proposal, in this case indy.
   * see {@link V2CredProposalFormat}
   * @param credentialRecord the record containing attributes for this credentual
   */
  public async setMetaDataAndEmitEventForOffer(
    offer: V2CredProposeOfferRequestFormat,
    credentialRecord: CredentialRecord
  ): Promise<void> {
    if (offer.indy?.payload.credentialPayload) {
      const credOffer: CredOffer = offer.indy.payload.credentialPayload as CredOffer

      credentialRecord.metadata.set('_internal/indyCredential', {
        schemaId: credOffer.schema_id,
        credentialDefinintionId: credOffer.cred_def_id,
      })
    }
  }
  /**
   * Set the meta data only
   * @param offer the object containing information about the offer, including the indy sdk specific stuff
   * @param credentialRecord the credential record containing the credential data and surrounding v2 attachments
   * @returns void
   */
  public setMetaDataForOffer(offer: V2CredProposeOfferRequestFormat, credentialRecord: CredentialRecord): void {
    if (offer.indy?.payload.credentialPayload) {
      const credOffer: CredOffer = offer.indy.payload.credentialPayload as CredOffer

      credentialRecord.metadata.set('_internal/indyCredential', {
        schemaId: credOffer.schema_id,
        credentialDefinintionId: credOffer.cred_def_id,
      })
    }
  }

  /**
   * Set the meta data only for a credential request
   * @param request the object containing information about the request, including the indy sdk specific stuff
   * @param credentialRecord the credential record containing the credential data and surrounding v2 attachments
   * @returns void
   */
  public setMetaDataForRequest(request: V2CredProposeOfferRequestFormat, credentialRecord: CredentialRecord): void {
    if (request.indy?.payload.requestMetaData) {
      credentialRecord.metadata.set(CredentialMetadataKeys.IndyRequest, request.indy?.payload.requestMetaData)
    }
  }

  /**
   * Save the meta data and emit event for a credential proposal
   * @param proposal wrapper object that contains either indy or some other format of proposal, in this case indy.
   * see {@link V2CredProposalFormat}
   * @param credentialRecord the record containing attributes for this credentual
   */
  public async setMetaDataForProposal(
    proposal: V2CredProposeOfferRequestFormat,
    credentialRecord: CredentialRecord
  ): Promise<void> {
    const credPropose: CredPropose = proposal.indy?.payload as CredPropose

    credentialRecord.metadata.set('_internal/indyCredential', {
      schemaId: credPropose.schemaId,
      credentialDefinintionId: credPropose.credentialDefinitionId,
    })
  }
}
