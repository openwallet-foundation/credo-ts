import { plainToClass } from 'class-transformer'

import { CredentialRecord, CredentialState } from '../../modules/credentials'

describe('transformers', () => {
  it('transforms an old credential record', () => {
    const credentialRecord = new CredentialRecord({ state: CredentialState.Done, threadId: '0' })
    const jsonCredentialRecord = credentialRecord.toJSON()

    const metadata = jsonCredentialRecord.metadata as Record<string, Record<string, string> | string>

    metadata.requestMetadata = { cred_req: 'x' }
    metadata.schemaId = 'abc:def'
    metadata.credentialDefinitionId = 'abc:def:CL'

    const cr = plainToClass(CredentialRecord, jsonCredentialRecord)

    expect(cr.metadata.data).toEqual({
      indyRequest: {
        cred_req: 'x',
      },
      indyCredential: {
        schemaId: 'abc:def',
        credentialDefinitionId: 'abc:def:CL',
      },
    })
  })
})
