import type { DifPresentationExchangeDefinitionV1 } from '@credo-ts/core'

export const TEST_INPUT_DESCRIPTORS_CITIZENSHIP = {
  constraints: {
    fields: [
      {
        path: ['$.credentialSubject.degree.type'],
      },
    ],
  },
  id: 'citizenship_input_1',
  schema: [{ uri: 'https://www.w3.org/2018/credentials/examples/v1' }],
} satisfies DifPresentationExchangeDefinitionV1['input_descriptors'][number]
