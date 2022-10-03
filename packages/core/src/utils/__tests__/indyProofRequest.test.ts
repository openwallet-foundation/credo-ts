import { checkProofRequestForDuplicates } from '../indyProofRequest'

import {
  AriesFrameworkError,
  AttributeFilter,
  PredicateType,
  ProofAttributeInfo,
  ProofPredicateInfo,
  ProofRequest,
} from '@aries-framework/core'

describe('Present Proof', () => {
  const credDefId = '9vPXgSpQJPkJEALbLXueBp:3:CL:57753:tag1'
  const nonce = 'testtesttest12345'

  test('attribute names match', () => {
    const attributes = {
      age1: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
      age2: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    const proofRequest = new ProofRequest({
      name: 'proof-request',
      version: '1.0',
      nonce,
      requestedAttributes: attributes,
    })

    expect(() => checkProofRequestForDuplicates(proofRequest)).not.toThrow()
  })

  test('attribute names match with predicates name', () => {
    const attributes = {
      attrib: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    const predicates = {
      predicate: new ProofPredicateInfo({
        name: 'age',
        predicateType: PredicateType.GreaterThanOrEqualTo,
        predicateValue: 50,
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    const proofRequest = new ProofRequest({
      name: 'proof-request',
      version: '1.0',
      nonce,
      requestedAttributes: attributes,
      requestedPredicates: predicates,
    })

    expect(() => checkProofRequestForDuplicates(proofRequest)).toThrowError(AriesFrameworkError)
  })
})
