import { JsonTransformer } from '../../../../utils'
import { CredentialExchangeRecord } from '../CredentialExchangeRecord'

describe('CredentialExchangeRecord', () => {
  test('should transform anoncreds to w3c', () => {
    const credentialExchangeRecord = JsonTransformer.fromJSON(
      {
        credentials: [
          {
            credentialRecordId: '23ba1abe-cc45-45c1-8c2a-9ed84acd5a78',
            credentialRecordType: 'w3c',
          },
          {
            credentialRecordId: '6e075f63-cc9d-44d3-9eb0-431eb8349d01',
            credentialRecordType: 'jsonld',
          },
          {
            credentialRecordId: 'eab51317-4fa4-4c8d-8c13-6daf52cae241',
            credentialRecordType: 'anoncreds',
          },
        ],
      },
      CredentialExchangeRecord,
      { validate: false }
    )

    expect(credentialExchangeRecord.credentials).toEqual([
      {
        credentialRecordId: '23ba1abe-cc45-45c1-8c2a-9ed84acd5a78',
        credentialRecordType: 'w3c',
      },
      {
        credentialRecordId: '6e075f63-cc9d-44d3-9eb0-431eb8349d01',
        credentialRecordType: 'jsonld',
      },
      {
        credentialRecordId: 'eab51317-4fa4-4c8d-8c13-6daf52cae241',
        credentialRecordType: 'w3c',
      },
    ])
  })
})
