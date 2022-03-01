import { checkProofRequestForDuplicates } from '..'

import {
  AriesFrameworkError,
  AttributeFilter,
  PredicateType,
  ProofAttributeInfo,
  ProofPredicateInfo,
  ProofRequest,
} from '@aries-framework/core'

export const INDY_CREDENTIAL_OFFER_ATTACHMENT_ID = 'libindy-cred-offer-0'

describe('Present Proof', () => {
  let credDefId: string

  beforeAll(async () => {
    credDefId = '9vPXgSpQJPkJEALbLXueBp:3:CL:57753:tag1'
  })

  test('attribute names match, same cred def filter', async () => {
    const attributes = {
      name: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
      age: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    const nonce = 'testtesttest12345'

    const proofRequest = new ProofRequest({
      name: 'proof-request',
      version: '1.0',
      nonce,
      requestedAttributes: attributes,
    })

    expect(() => checkProofRequestForDuplicates(proofRequest)).toThrowError(AriesFrameworkError)
  })

  test('attribute names match with predicates name, same cred def filter', async () => {
    const attributes = {
      name: new ProofAttributeInfo({
        name: 'age',
        restrictions: [
          new AttributeFilter({
            credentialDefinitionId: credDefId,
          }),
        ],
      }),
    }

    const predicates = {
      age: new ProofPredicateInfo({
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

    const nonce = 'testtesttest12345'

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
