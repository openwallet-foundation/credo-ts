import type { W3cCredentialRecord } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import { KeyType, W3cJwtVerifiableCredential, Agent, Buffer } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'

import { OpenId4VcHolderModule, OpenId4VpHolderService } from '../src'

const modules = {
  openId4VcClient: new OpenId4VcHolderModule(),
  askar: new AskarModule({
    ariesAskar,
  }),
}

describe('OpenId4VcClient | OpenID4VP', () => {
  let agent: Agent<typeof modules>

  beforeEach(async () => {
    agent = new Agent({
      config: {
        label: 'OpenId4VcClient OpenID4VP Test',
        walletConfig: {
          id: 'openid4vc-client-openid4vp-test',
          key: 'openid4vc-client-openid4vp-test',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    await agent.initialize()
  })

  afterEach(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  describe('Mattr interop', () => {
    // Not working yet. Once it works, we can mock the requests/responses
    xit('Should succesfuly share a proof with MATTR launchpad', async () => {
      // Store needed credential / did / key
      await agent.w3cCredentials.storeCredential({
        credential: W3cJwtVerifiableCredential.fromSerializedJwt(
          'eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDp3ZWI6bGF1bmNocGFkLnZpaS5lbGVjdHJvbi5tYXR0cmxhYnMuaW8jNkJoRk1DR1RKZyJ9.eyJpc3MiOiJkaWQ6d2ViOmxhdW5jaHBhZC52aWkuZWxlY3Ryb24ubWF0dHJsYWJzLmlvIiwic3ViIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJuYmYiOjE2OTYwMjI5NDksImV4cCI6MTcyNzY0NTM0OSwidmMiOnsibmFtZSI6IkV4YW1wbGUgVW5pdmVyc2l0eSBEZWdyZWUiLCJkZXNjcmlwdGlvbiI6IkpGRiBQbHVnZmVzdCAzIE9wZW5CYWRnZSBDcmVkZW50aWFsIiwiY3JlZGVudGlhbEJyYW5kaW5nIjp7ImJhY2tncm91bmRDb2xvciI6IiM0NjRjNDkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL21hdHRyLmdsb2JhbC9jb250ZXh0cy92Yy1leHRlbnNpb25zL3YyIiwiaHR0cHM6Ly9wdXJsLmltc2dsb2JhbC5vcmcvc3BlYy9vYi92M3AwL2NvbnRleHQtMy4wLjIuanNvbiIsImh0dHBzOi8vcHVybC5pbXNnbG9iYWwub3JnL3NwZWMvb2IvdjNwMC9leHRlbnNpb25zLmpzb24iLCJodHRwczovL3czaWQub3JnL3ZjLXJldm9jYXRpb24tbGlzdC0yMDIwL3YxIl0sInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJPcGVuQmFkZ2VDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJ0eXBlIjpbIkFjaGlldmVtZW50U3ViamVjdCJdLCJhY2hpZXZlbWVudCI6eyJpZCI6Imh0dHBzOi8vZXhhbXBsZS5jb20vYWNoaWV2ZW1lbnRzLzIxc3QtY2VudHVyeS1za2lsbHMvdGVhbXdvcmsiLCJuYW1lIjoiVGVhbXdvcmsiLCJ0eXBlIjpbIkFjaGlldmVtZW50Il0sImltYWdlIjp7ImlkIjoiaHR0cHM6Ly93M2MtY2NnLmdpdGh1Yi5pby92Yy1lZC9wbHVnZmVzdC0zLTIwMjMvaW1hZ2VzL0pGRi1WQy1FRFUtUExVR0ZFU1QzLWJhZGdlLWltYWdlLnBuZyIsInR5cGUiOiJJbWFnZSJ9LCJjcml0ZXJpYSI6eyJuYXJyYXRpdmUiOiJUZWFtIG1lbWJlcnMgYXJlIG5vbWluYXRlZCBmb3IgdGhpcyBiYWRnZSBieSB0aGVpciBwZWVycyBhbmQgcmVjb2duaXplZCB1cG9uIHJldmlldyBieSBFeGFtcGxlIENvcnAgbWFuYWdlbWVudC4ifSwiZGVzY3JpcHRpb24iOiJUaGlzIGJhZGdlIHJlY29nbml6ZXMgdGhlIGRldmVsb3BtZW50IG9mIHRoZSBjYXBhY2l0eSB0byBjb2xsYWJvcmF0ZSB3aXRoaW4gYSBncm91cCBlbnZpcm9ubWVudC4ifX0sImlzc3VlciI6eyJpZCI6ImRpZDp3ZWI6bGF1bmNocGFkLnZpaS5lbGVjdHJvbi5tYXR0cmxhYnMuaW8iLCJuYW1lIjoiRXhhbXBsZSBVbml2ZXJzaXR5IiwiaWNvblVybCI6Imh0dHBzOi8vdzNjLWNjZy5naXRodWIuaW8vdmMtZWQvcGx1Z2Zlc3QtMS0yMDIyL2ltYWdlcy9KRkZfTG9nb0xvY2t1cC5wbmciLCJpbWFnZSI6Imh0dHBzOi8vdzNjLWNjZy5naXRodWIuaW8vdmMtZWQvcGx1Z2Zlc3QtMS0yMDIyL2ltYWdlcy9KRkZfTG9nb0xvY2t1cC5wbmcifX19.HUYvivfEH2-yBXUq6t5gEZu1NY7_6tjsWojQvYbpRL_md5TyAmwn-LyfcPLyrQpgJcu08XjFp8smXFMfYJEqCQ'
        ),
      })

      await agent.wallet.createKey({
        keyType: KeyType.Ed25519,
        seed: Buffer.from('00000000000000000000000000000000'),
      })

      await agent.dids.import({
        did: 'did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
      })

      const openId4VpHolderService = agent.dependencyManager.resolve(OpenId4VpHolderService)
      const { selectResults, verifiedAuthorizationRequest } =
        await openId4VpHolderService.selectCredentialForProofRequest(agent.context, {
          authorizationRequest:
            'openid4vp://authorize?client_id=https%3A%2F%2Flaunchpad.mattrlabs.com%2Fapi%2Fvp%2Fcallback&client_id_scheme=redirect_uri&response_uri=https%3A%2F%2Flaunchpad.mattrlabs.com%2Fapi%2Fvp%2Fcallback&response_type=vp_token&response_mode=direct_post&presentation_definition_uri=https%3A%2F%2Flaunchpad.mattrlabs.com%2Fapi%2Fvp%2Frequest%3Fstate%3D9b2nQuoLQkW0bX_vk24qjg&nonce=u-Wg1dR5wo5IqIr8ilshMQ&state=9b2nQuoLQkW0bX_vk24qjg',
        })

      if (!selectResults.areRequirementsSatisfied) {
        throw new Error('Requirements are not satisfied.')
      }

      const credentialRecords = selectResults.requirements
        .flatMap((requirement) => requirement.submission.flatMap((submission) => submission.verifiableCredentials))
        .filter((credentialRecord): credentialRecord is W3cCredentialRecord => credentialRecord !== undefined)

      const credentials = credentialRecords.map((credentialRecord) => credentialRecord.credential)

      //await openId4VpHolderService.shareProof(agent.context, {
      //  verifiedAuthorizationRequest,
      //  selectedCredentials: credentials,
      //})
    })
  })
})
