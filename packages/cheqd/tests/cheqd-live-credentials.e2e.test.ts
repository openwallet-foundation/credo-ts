import { Agent, W3cJwtVerifiableCredential } from '@credo-ts/core'

import { getAgentOptions } from '../../core/tests/helpers'
import { getCheqdModules } from './setupCheqdModule'

// Reads credentials Studio issued with Veramo that are on the public testnet, so it needs the network and the data to
// still be there (testnet has been reset before). Set RUN_LIVE_COMPAT=true to run it. Read-only.
const live = process.env.RUN_LIVE_COMPAT === 'true'

// Trust chain accreditations issued by Studio: JWT credentials in the `JwtProof2020` form, with a Bitstring status entry.
// They were later revoked, which is what their status list says.
const accreditations = [
  { collection: '11ceabbd-1fdc-46c0-a15d-534c07926d2b', resource: '7591292e-c7d7-4008-883f-74a4d5f177fe', index: 218 },
  { collection: '11ceabbd-1fdc-46c0-a15d-534c07926d2b', resource: '4034d169-9b32-46bc-95d2-ce537f27846a', index: 219 },
  { collection: '11ceabbd-1fdc-46c0-a15d-534c07926d2b', resource: '9caa57b8-75ab-4520-bbd6-984fc28478da', index: 220 },
]

describe.skipIf(!live)('Credentials issued by Veramo, on the public testnet', () => {
  const agent = new Agent(
    getAgentOptions('Live credentials', {}, {}, getCheqdModules(undefined, 'https://rpc.cheqd.network'))
  )

  beforeAll(() => agent.initialize())
  afterAll(() => agent.shutdown())

  it.each(accreditations)(
    'verifies accreditation $resource and reads its status',
    async ({ collection, resource, index }) => {
      const did = `did:cheqd:testnet:${collection}`
      const { resource: stored } = await agent.modules.cheqdSdk.resolveResource(`${did}/resources/${resource}`)
      const credential = stored as { issuer: { id: string }; proof: { jwt: string }; credentialStatus: object }

      // The signature, data model and issuer. Credo does not check the status of JWT credentials itself, so that is switched
      // off here and read from the Bitstring list below.
      const result = await agent.w3cCredentials.verifyCredential({
        credential: W3cJwtVerifiableCredential.fromSerializedJwt(credential.proof.jwt),
        verifyCredentialStatus: false,
      })
      expect(result.isValid, result.isValid ? '' : JSON.stringify(result.validations)).toBe(true)

      const [status] = await agent.modules.cheqdSdk.checkLegacyCredentialStatus(
        credential as Parameters<typeof agent.modules.cheqdSdk.checkLegacyCredentialStatus>[0]
      )
      expect(status).toMatchObject({ statusListIndex: index, message: 'revoked', revoked: true, valid: false })
    }
  )
})
