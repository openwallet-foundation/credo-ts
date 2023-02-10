import type { AnonCredsProofRequest } from '../../models'

import { hasDuplicateGroupsNamesInProofRequest } from '../hasDuplicateGroupNames'

const credentialDefinitionId = '9vPXgSpQJPkJEALbLXueBp:3:CL:57753:tag1'

describe('util | hasDuplicateGroupsNamesInProofRequest', () => {
  describe('assertNoDuplicateGroupsNamesInProofRequest', () => {
    test('attribute names match', () => {
      const proofRequest = {
        name: 'proof-request',
        version: '1.0',
        nonce: 'testtesttest12345',
        requested_attributes: {
          age1: {
            name: 'age',
            restrictions: [
              {
                cred_def_id: credentialDefinitionId,
              },
            ],
          },
          age2: {
            name: 'age',
            restrictions: [
              {
                cred_def_id: credentialDefinitionId,
              },
            ],
          },
        },
        requested_predicates: {},
      } satisfies AnonCredsProofRequest

      expect(hasDuplicateGroupsNamesInProofRequest(proofRequest)).toBe(false)
    })

    test('attribute names match with predicates name', () => {
      const proofRequest = {
        name: 'proof-request',
        version: '1.0',
        nonce: 'testtesttest12345',
        requested_attributes: {
          attrib: {
            name: 'age',
            restrictions: [
              {
                cred_def_id: credentialDefinitionId,
              },
            ],
          },
        },
        requested_predicates: {
          predicate: {
            name: 'age',
            p_type: '>=',
            p_value: 50,
            restrictions: [
              {
                cred_def_id: credentialDefinitionId,
              },
            ],
          },
        },
      } satisfies AnonCredsProofRequest

      expect(hasDuplicateGroupsNamesInProofRequest(proofRequest)).toBe(true)
    })
  })
})
