import { JsonTransformer } from '../../../utils/JsonTransformer'
import { MessageValidator } from '../../../utils/MessageValidator'
import { ProofRequest } from '../formats/indy/models/ProofRequest'

describe('ProofRequest', () => {
  it('should successfully validate if the proof request json contains a valid structure', async () => {
    const proofRequest = JsonTransformer.fromJSON(
      {
        name: 'ProofRequest',
        version: '1.0',
        nonce: '947121108704767252195123',
        requested_attributes: {
          First: {
            name: 'Timo',
            restrictions: [
              {
                schema_id: 'string',
              },
            ],
          },
        },
        requested_predicates: {
          Second: {
            name: 'Timo',
            p_type: '<=',
            p_value: 10,
            restrictions: [
              {
                schema_id: 'string',
              },
            ],
          },
        },
      },
      ProofRequest
    )

    expect(MessageValidator.validate(proofRequest)).resolves.not.toThrow()
  })

  it('should throw an error if the proof request json contains an invalid structure', async () => {
    const proofRequest = JsonTransformer.fromJSON(
      {
        name: 'ProofRequest',
        version: '1.0',
        nonce: '947121108704767252195123',
        requested_attributes: {
          First: {
            names: [],
            restrictions: [
              {
                schema_id: 'string',
              },
            ],
          },
        },
        requested_predicates: [
          {
            name: 'Timo',
            p_type: '<=',
            p_value: 10,
            restrictions: [
              {
                schema_id: 'string',
              },
            ],
          },
        ],
      },
      ProofRequest
    )

    // Expect 2 top level validation errors
    expect(MessageValidator.validate(proofRequest)).rejects.toHaveLength(2)
  })
})
