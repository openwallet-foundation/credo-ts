import { JsonTransformer } from '../../../utils/JsonTransformer'
import { MessageValidator } from '../../../utils/MessageValidator'
import { ProofRequest } from '../formats/indy/models/ProofRequest'

describe('ProofRequest', () => {
  it('should successfully validate if the proof request JSON contains a valid structure', async () => {
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
                schema_id: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
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
                schema_id: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
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
                schema_id: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
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
                schema_id: 'q7ATwTYbQDgiigVijUAej:2:test:1.0',
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
