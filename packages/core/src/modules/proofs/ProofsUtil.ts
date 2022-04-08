import type { CreateProposalOptions } from './models/ProofServiceOptions'
import type { ProofRequestFormats } from './models/SharedOptions'
import type { PresentationPreviewAttribute } from './protocol/v1/models/PresentationPreview'

import { AriesFrameworkError } from '../../error/AriesFrameworkError'
import { uuid } from '../../utils/uuid'

import { ProofRequest } from './formats/indy/models/ProofRequest'
import { AttributeFilter } from './protocol/v1/models/AttributeFilter'
import { ProofAttributeInfo } from './protocol/v1/models/ProofAttributeInfo'
import { ProofPredicateInfo } from './protocol/v1/models/ProofPredicateInfo'

export class ProofsUtils {
  public static async createRequestFromPreview(options: CreateProposalOptions): Promise<ProofRequestFormats> {
    const indyConfig = options.proofFormats?.indy

    if (!indyConfig) {
      throw new AriesFrameworkError('No Indy format found.')
    }

    const preview = options.proofFormats.indy?.proofPreview

    if (!preview) {
      throw new AriesFrameworkError(`No preview found`)
    }

    const proofRequest = new ProofRequest({
      name: indyConfig.name,
      version: indyConfig.version,
      nonce: indyConfig.nonce,
    })

    /**
     * Create mapping of attributes by referent. This required the
     * attributes to come from the same credential.
     * @see https://github.com/hyperledger/aries-rfcs/blob/master/features/0037-present-proof/README.md#referent
     *
     * {
     *  "referent1": [Attribute1, Attribute2],
     *  "referent2": [Attribute3]
     * }
     */
    const attributesByReferent: Record<string, PresentationPreviewAttribute[]> = {}
    for (const proposedAttributes of preview.attributes) {
      if (!proposedAttributes.referent) proposedAttributes.referent = uuid()

      const referentAttributes = attributesByReferent[proposedAttributes.referent]

      // Referent key already exist, add to list
      if (referentAttributes) {
        referentAttributes.push(proposedAttributes)
      }

      // Referent key does not exist yet, create new entry
      else {
        attributesByReferent[proposedAttributes.referent] = [proposedAttributes]
      }
    }

    // Transform attributes by referent to requested attributes
    for (const [referent, proposedAttributes] of Object.entries(attributesByReferent)) {
      // Either attributeName or attributeNames will be undefined
      const attributeName = proposedAttributes.length == 1 ? proposedAttributes[0].name : undefined
      const attributeNames = proposedAttributes.length > 1 ? proposedAttributes.map((a) => a.name) : undefined

      const requestedAttribute = new ProofAttributeInfo({
        name: attributeName,
        names: attributeNames,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: proposedAttributes[0].credentialDefinitionId,
          }),
        ],
      })

      proofRequest.requestedAttributes.set(referent, requestedAttribute)
    }

    // this.logger.debug('proposal predicates', indyFormat.presentationProposal.predicates)
    // Transform proposed predicates to requested predicates
    for (const proposedPredicate of preview.predicates) {
      const requestedPredicate = new ProofPredicateInfo({
        name: proposedPredicate.name,
        predicateType: proposedPredicate.predicate,
        predicateValue: proposedPredicate.threshold,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: proposedPredicate.credentialDefinitionId,
          }),
        ],
      })

      proofRequest.requestedPredicates.set(uuid(), requestedPredicate)
    }

    return {
      indy: proofRequest,
    }
  }
}
