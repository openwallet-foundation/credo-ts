import type { CreateProposalOptions } from '../../models/ProofServiceOptions'
import type { ProofRequestFormats } from '../../models/SharedOptions'
import type { PresentationPreviewAttribute } from '../../protocol/v1/models/V1PresentationPreview'
import type { IndyProposeProofFormat } from '../IndyProofFormatsServiceOptions'

import { AriesFrameworkError } from '../../../../error/AriesFrameworkError'
import { uuid } from '../../../../utils/uuid'
import { AttributeFilter } from '../../protocol/v1/models/AttributeFilter'
import { PresentationPreview } from '../../protocol/v1/models/V1PresentationPreview'

import { ProofAttributeInfo } from './models/ProofAttributeInfo'
import { ProofPredicateInfo } from './models/ProofPredicateInfo'
import { ProofRequest } from './models/ProofRequest'

export class IndyProofUtils {
  public static async createRequestFromPreview(options: CreateProposalOptions): Promise<ProofRequestFormats> {
    const indyFormat = options.proofFormats?.indy

    if (!indyFormat) {
      throw new AriesFrameworkError('No Indy format found.')
    }

    const preview = new PresentationPreview({
      attributes: indyFormat.attributes,
      predicates: indyFormat.predicates,
    })

    if (!preview) {
      throw new AriesFrameworkError(`No preview found`)
    }

    const proofRequest = IndyProofUtils.createReferentForProofRequest(indyFormat, preview)

    return {
      indy: proofRequest,
    }
  }

  public static createReferentForProofRequest(indyFormat: IndyProposeProofFormat, preview: PresentationPreview) {
    const proofRequest = new ProofRequest({
      name: indyFormat.name,
      version: indyFormat.version,
      nonce: indyFormat.nonce,
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

    return proofRequest
  }
}
