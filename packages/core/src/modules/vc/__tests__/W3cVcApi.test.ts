import { IndySdkModule } from '../../../../../indy-sdk/src'
import { getAgentOptions, indySdk } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { JsonTransformer } from '../../../utils'
import { W3cVcModule } from '../W3cVcModule'
import { W3cVerifiableCredential } from '../models'

import { customDocumentLoader } from './documentLoader'
import { Ed25519Signature2018Fixtures } from './fixtures'

const modules = {
  w3cVc: new W3cVcModule({
    documentLoader: customDocumentLoader,
  }),
  indySdk: new IndySdkModule({
    indySdk,
  }),
}

const agentOptions = getAgentOptions<typeof modules>('W3cVcApi', {}, modules)

const agent = new Agent(agentOptions)

describe('W3cVcApi', () => {
  beforeAll(async () => {
    await agent.initialize()
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  it('Should successfully store a credential', async () => {
    const credential = JsonTransformer.fromJSON(
      Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
      W3cVerifiableCredential
    )

    const storedCredential = await agent.modules.w3cVc.storeCredential({
      credential,
    })

    const retrievedCredentials = await agent.modules.w3cVc.getAllCredentialRecords()

    expect(retrievedCredentials.length).toBe(1)
    expect(retrievedCredentials[0].id).toStrictEqual(storedCredential.id)
  })
})
