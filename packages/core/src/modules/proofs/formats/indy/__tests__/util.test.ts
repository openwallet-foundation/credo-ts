import type { default as Indy } from 'indy-sdk'

import { AriesFrameworkError } from '../../../../../error'
import { AttributeFilter, PredicateType, ProofAttributeInfo, ProofPredicateInfo, ProofRequest } from '../models'
import { areIndyProofRequestsEqual, assertNoDuplicateGroupsNamesInProofRequest } from '../util'

const proofRequest = {
  name: 'Proof Request',
  version: '1.0.0',
  nonce: 'nonce',
  ver: '1.0',
  non_revoked: {},
  requested_attributes: {
    a: {
      names: ['name1', 'name2'],
      restrictions: [
        {
          cred_def_id: 'cred_def_id1',
        },
        {
          schema_id: 'schema_id',
        },
      ],
    },
  },
  requested_predicates: {
    p: {
      name: 'Hello',
      p_type: '<',
      p_value: 10,
      restrictions: [
        {
          cred_def_id: 'string2',
        },
        {
          cred_def_id: 'string',
        },
      ],
    },
  },
} satisfies Indy.IndyProofRequest

const credDefId = '9vPXgSpQJPkJEALbLXueBp:3:CL:57753:tag1'
const nonce = 'testtesttest12345'

describe('IndyProofFormat | util', () => {
  describe('assertNoDuplicateGroupsNamesInProofRequest', () => {
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

      expect(() => assertNoDuplicateGroupsNamesInProofRequest(proofRequest)).not.toThrow()
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

      expect(() => assertNoDuplicateGroupsNamesInProofRequest(proofRequest)).toThrowError(AriesFrameworkError)
    })
  })
  describe('areIndyProofRequestsEqual', () => {
    test('does not compare name, ver, version and nonce', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          name: 'Proof Request 2',
          version: '2.0.0',
          nonce: 'nonce2',
          ver: '2.0',
        })
      ).toBe(true)
    })

    test('check top level non_revocation interval', () => {
      // empty object is semantically equal to undefined
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          non_revoked: {},
        })
      ).toBe(true)

      // properties inside object are different
      expect(
        areIndyProofRequestsEqual(
          {
            ...proofRequest,
            non_revoked: {
              to: 5,
            },
          },
          {
            ...proofRequest,
            non_revoked: {
              from: 5,
            },
          }
        )
      ).toBe(false)

      // One has non_revoked, other doesn't
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          non_revoked: {
            from: 5,
          },
        })
      ).toBe(false)
    })

    test('ignores attribute group name differences', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_attributes: {
            b: proofRequest.requested_attributes.a,
          },
        })
      ).toBe(true)
    })

    test('ignores attribute restriction order', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_attributes: {
            a: {
              ...proofRequest.requested_attributes.a,
              restrictions: [...proofRequest.requested_attributes.a.restrictions].reverse(),
            },
          },
        })
      ).toBe(true)
    })

    test('ignores attribute restriction undefined vs empty array', () => {
      expect(
        areIndyProofRequestsEqual(
          {
            ...proofRequest,
            requested_attributes: {
              a: {
                ...proofRequest.requested_attributes.a,
                restrictions: undefined,
              },
            },
          },
          {
            ...proofRequest,
            requested_attributes: {
              a: {
                ...proofRequest.requested_attributes.a,
                restrictions: [],
              },
            },
          }
        )
      ).toBe(true)
    })

    test('ignores attribute names order', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_attributes: {
            a: {
              ...proofRequest.requested_attributes.a,
              names: ['name2', 'name1'],
            },
          },
        })
      ).toBe(true)
    })

    test('checks attribute non_revocation interval', () => {
      // empty object is semantically equal to undefined
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_attributes: {
            a: {
              ...proofRequest.requested_attributes.a,
              non_revoked: {},
            },
          },
        })
      ).toBe(true)

      // properties inside object are different
      expect(
        areIndyProofRequestsEqual(
          {
            ...proofRequest,
            requested_attributes: {
              a: {
                ...proofRequest.requested_attributes.a,
                non_revoked: {
                  to: 5,
                },
              },
            },
          },
          {
            ...proofRequest,
            requested_attributes: {
              a: {
                ...proofRequest.requested_attributes.a,
                non_revoked: {
                  from: 5,
                },
              },
            },
          }
        )
      ).toBe(false)

      // One has non_revoked, other doesn't
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_attributes: {
            a: {
              ...proofRequest.requested_attributes.a,
              non_revoked: {
                from: 5,
              },
            },
          },
        })
      ).toBe(false)
    })

    test('checks attribute restriction differences', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_attributes: {
            a: {
              ...proofRequest.requested_attributes.a,
              restrictions: [
                {
                  cred_def_id: 'cred_def_id1',
                },
                {
                  cred_def_id: 'cred_def_id2',
                },
              ],
            },
          },
        })
      ).toBe(false)
    })

    test('checks attribute name differences', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_attributes: {
            a: {
              ...proofRequest.requested_attributes.a,
              names: ['name3'],
            },
          },
        })
      ).toBe(false)

      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_attributes: {
            a: {
              ...proofRequest.requested_attributes.a,
              name: 'name3',
              names: undefined,
            },
          },
        })
      ).toBe(false)
    })

    test('allows names with one value to be same as name property', () => {
      expect(
        areIndyProofRequestsEqual(
          {
            ...proofRequest,
            requested_attributes: {
              a: {
                ...proofRequest.requested_attributes.a,
                name: 'name1',
              },
            },
          },
          {
            ...proofRequest,
            requested_attributes: {
              a: {
                ...proofRequest.requested_attributes.a,
                names: ['name1'],
              },
            },
          }
        )
      ).toBe(true)

      expect(
        areIndyProofRequestsEqual(
          {
            ...proofRequest,
            requested_attributes: {
              a: {
                ...proofRequest.requested_attributes.a,
                name: 'name1',
              },
            },
          },
          {
            ...proofRequest,
            requested_attributes: {
              a: {
                ...proofRequest.requested_attributes.a,
                names: ['name2'],
              },
            },
          }
        )
      ).toBe(false)
    })

    test('ignores predicate group name differences', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_predicates: {
            a: proofRequest.requested_predicates.p,
          },
        })
      ).toBe(true)
    })

    test('ignores predicate restriction order', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_predicates: {
            p: {
              ...proofRequest.requested_predicates.p,
              restrictions: [...proofRequest.requested_predicates.p.restrictions].reverse(),
            },
          },
        })
      ).toBe(true)
    })

    test('ignores predicate restriction undefined vs empty array', () => {
      expect(
        areIndyProofRequestsEqual(
          {
            ...proofRequest,
            requested_predicates: {
              p: {
                ...proofRequest.requested_predicates.p,
                restrictions: undefined,
              },
            },
          },
          {
            ...proofRequest,
            requested_predicates: {
              p: {
                ...proofRequest.requested_predicates.p,
                restrictions: [],
              },
            },
          }
        )
      ).toBe(true)
    })

    test('checks predicate restriction differences', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_attributes: {
            p: {
              ...proofRequest.requested_predicates.p,
              restrictions: [
                {
                  cred_def_id: 'cred_def_id1',
                },
                {
                  cred_def_id: 'cred_def_id2',
                },
              ],
            },
          },
        })
      ).toBe(false)
    })

    test('checks predicate name differences', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_predicates: {
            p: {
              ...proofRequest.requested_predicates.p,
              name: 'name3',
            },
          },
        })
      ).toBe(false)
    })

    test('checks predicate non_revocation interval', () => {
      // empty object is semantically equal to undefined
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_predicates: {
            p: {
              ...proofRequest.requested_predicates.p,
              non_revoked: {},
            },
          },
        })
      ).toBe(true)

      // properties inside object are different
      expect(
        areIndyProofRequestsEqual(
          {
            ...proofRequest,
            requested_predicates: {
              p: {
                ...proofRequest.requested_predicates.p,
                non_revoked: {
                  to: 5,
                },
              },
            },
          },
          {
            ...proofRequest,
            requested_predicates: {
              p: {
                ...proofRequest.requested_predicates.p,
                non_revoked: {
                  from: 5,
                },
              },
            },
          }
        )
      ).toBe(false)

      // One has non_revoked, other doesn't
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_predicates: {
            p: {
              ...proofRequest.requested_predicates.p,
              non_revoked: {
                from: 5,
              },
            },
          },
        })
      ).toBe(false)
    })

    test('checks predicate p_type and p_value', () => {
      expect(
        areIndyProofRequestsEqual(proofRequest, {
          ...proofRequest,
          requested_predicates: {
            p: {
              ...proofRequest.requested_predicates.p,
              p_type: '<',
              p_value: 134134,
            },
          },
        })
      ).toBe(false)
    })
  })
})
