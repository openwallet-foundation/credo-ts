import { JsonTransformer } from '../../../utils/JsonTransformer'
import { ProofRequest } from '../models'

describe('ProofRequest', () => {
  it('should successfully validate if the proof request json contains a valid structure', async () => {
    const proofRequest = await JsonTransformer.fromJSON(
      {
        name: 'ProofRequest',
        version: '1.0',
        nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
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
      ProofRequest,
      { validate: true }
    )

    await expect(async () => proofRequest).resolves
  })

  it('should throw an error if the proof request json contains an invalid structure', async () => {
    const proofRequest = {
      name: 'ProofRequest',
      version: '1.0',
      nonce: '58d223e5-fc4d-4448-b74c-5eb11c6b558f',
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
    }

    // Expect 2 top level validation errors
    await expect(async () => await JsonTransformer.fromJSON(proofRequest, ProofRequest, { validate: true })).rejects
  })
})
