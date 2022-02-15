import { plainToInstance } from 'class-transformer'

import { CredentialExchangeRecord, CredentialState } from '../../modules/credentials'

describe('transformers', () => {
  it('transforms an old credential record', () => {
    // Mocked old credentialRecord
    const credentialRecord = new CredentialExchangeRecord({ state: CredentialState.Done, threadId: '0' })
    const jsonCredentialRecord = credentialRecord.toJSON()

    const metadata = jsonCredentialRecord.metadata as Record<string, Record<string, string> | string>
    metadata.requestMetadata = { cred_req: 'x' }
    metadata.schemaId = 'abc:def'
    metadata.credentialDefinitionId = 'abc:def:CL'

    // Converted old to new credentialRecord
    const cr = plainToInstance(CredentialExchangeRecord, jsonCredentialRecord)

    expect(cr.metadata.data).toEqual({
      '_internal/indyRequest': {
        cred_req: 'x',
      },
      '_internal/indyCredential': {
        schemaId: 'abc:def',
        credentialDefinitionId: 'abc:def:CL',
      },
    })
  })
})
