import type { KeyDidCreateOptions, VerificationMethod } from '@aries-framework/core'

import { AskarModule } from '@aries-framework/askar'
import { KeyType, Agent, TypedArrayEncoder, DidKey } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { PassBy, ResponseType, Scope, SigningAlgo, SubjectType } from '@sphereon/did-auth-siop'
import nock from 'nock'

import { OpenId4VcHolderModule } from '../src'
import { getSupportedDidMethods, staticOpSiopConfig } from '../src/presentations/OpenId4VpHolderService'

const modules = {
  openId4VcHolder: new OpenId4VcHolderModule(),
  askar: new AskarModule({ ariesAskar }),
}

describe('OpenId4VcHolder | OpenID4VP', () => {
  let rp: Agent<typeof modules>
  let rpVerificationMethod: VerificationMethod

  let op: Agent<typeof modules>
  let opVerificationMethod: VerificationMethod

  beforeEach(async () => {
    rp = new Agent({
      config: {
        label: 'OpenId4VcRp OpenID4VP Test',
        walletConfig: {
          id: 'openid4vc-rp-openid4vp-test',
          key: 'openid4vc-rp-openid4vp-test',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    op = new Agent({
      config: {
        label: 'OpenId4VcOp OpenID4VP Test',
        walletConfig: {
          id: 'openid4vc-op-openid4vp-test',
          key: 'openid4vc-op-openid4vp-test',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    await rp.initialize()
    await op.initialize()

    const rpDid = await rp.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.P256 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
    })

    const rpDidKey = DidKey.fromDid(rpDid.didState.did as string)
    const rpKid = `${rpDid.didState.did as string}#${rpDidKey.key.fingerprint}`
    const _rpVerificationMethod = rpDid.didState.didDocument?.dereferenceKey(rpKid, ['authentication'])
    if (!_rpVerificationMethod) throw new Error('No verification method found')
    rpVerificationMethod = _rpVerificationMethod

    const opDid = await op.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.P256 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598f') },
    })

    const opDidKey = DidKey.fromDid(opDid.didState.did as string)
    const opKid = `${opDid.didState.did as string}#${opDidKey.key.fingerprint}`
    const _opVerificationMethod = opDid.didState.didDocument?.dereferenceKey(opKid, ['authentication'])
    if (!_opVerificationMethod) throw new Error('No verification method found')
    opVerificationMethod = _opVerificationMethod
  })

  afterEach(async () => {
    await op.shutdown()
    await op.wallet.delete()
    await rp.shutdown()
    await rp.wallet.delete()
  })

  describe('Mattr interop', () => {
    // Not working yet. Once it works, we can mock the requests/responses
    // xit('Should succesfuly share a proof with MATTR launchpad', async () => {
    //   // Store needed credential / did / key
    //   await agent.w3cCredentials.storeCredential({
    //     credential: W3cJwtVerifiableCredential.fromSerializedJwt(
    //       'eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDp3ZWI6bGF1bmNocGFkLnZpaS5lbGVjdHJvbi5tYXR0cmxhYnMuaW8jNkJoRk1DR1RKZyJ9.eyJpc3MiOiJkaWQ6d2ViOmxhdW5jaHBhZC52aWkuZWxlY3Ryb24ubWF0dHJsYWJzLmlvIiwic3ViIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJuYmYiOjE2OTYwMjI5NDksImV4cCI6MTcyNzY0NTM0OSwidmMiOnsibmFtZSI6IkV4YW1wbGUgVW5pdmVyc2l0eSBEZWdyZWUiLCJkZXNjcmlwdGlvbiI6IkpGRiBQbHVnZmVzdCAzIE9wZW5CYWRnZSBDcmVkZW50aWFsIiwiY3JlZGVudGlhbEJyYW5kaW5nIjp7ImJhY2tncm91bmRDb2xvciI6IiM0NjRjNDkifSwiQGNvbnRleHQiOlsiaHR0cHM6Ly93d3cudzMub3JnLzIwMTgvY3JlZGVudGlhbHMvdjEiLCJodHRwczovL21hdHRyLmdsb2JhbC9jb250ZXh0cy92Yy1leHRlbnNpb25zL3YyIiwiaHR0cHM6Ly9wdXJsLmltc2dsb2JhbC5vcmcvc3BlYy9vYi92M3AwL2NvbnRleHQtMy4wLjIuanNvbiIsImh0dHBzOi8vcHVybC5pbXNnbG9iYWwub3JnL3NwZWMvb2IvdjNwMC9leHRlbnNpb25zLmpzb24iLCJodHRwczovL3czaWQub3JnL3ZjLXJldm9jYXRpb24tbGlzdC0yMDIwL3YxIl0sInR5cGUiOlsiVmVyaWZpYWJsZUNyZWRlbnRpYWwiLCJPcGVuQmFkZ2VDcmVkZW50aWFsIl0sImNyZWRlbnRpYWxTdWJqZWN0Ijp7ImlkIjoiZGlkOmtleTp6Nk1rdHF0WE5HOENEVVk5UHJydG9TdEZ6ZUNuaHBNbWd4WUwxZ2lrY1czQnp2TlciLCJ0eXBlIjpbIkFjaGlldmVtZW50U3ViamVjdCJdLCJhY2hpZXZlbWVudCI6eyJpZCI6Imh0dHBzOi8vZXhhbXBsZS5jb20vYWNoaWV2ZW1lbnRzLzIxc3QtY2VudHVyeS1za2lsbHMvdGVhbXdvcmsiLCJuYW1lIjoiVGVhbXdvcmsiLCJ0eXBlIjpbIkFjaGlldmVtZW50Il0sImltYWdlIjp7ImlkIjoiaHR0cHM6Ly93M2MtY2NnLmdpdGh1Yi5pby92Yy1lZC9wbHVnZmVzdC0zLTIwMjMvaW1hZ2VzL0pGRi1WQy1FRFUtUExVR0ZFU1QzLWJhZGdlLWltYWdlLnBuZyIsInR5cGUiOiJJbWFnZSJ9LCJjcml0ZXJpYSI6eyJuYXJyYXRpdmUiOiJUZWFtIG1lbWJlcnMgYXJlIG5vbWluYXRlZCBmb3IgdGhpcyBiYWRnZSBieSB0aGVpciBwZWVycyBhbmQgcmVjb2duaXplZCB1cG9uIHJldmlldyBieSBFeGFtcGxlIENvcnAgbWFuYWdlbWVudC4ifSwiZGVzY3JpcHRpb24iOiJUaGlzIGJhZGdlIHJlY29nbml6ZXMgdGhlIGRldmVsb3BtZW50IG9mIHRoZSBjYXBhY2l0eSB0byBjb2xsYWJvcmF0ZSB3aXRoaW4gYSBncm91cCBlbnZpcm9ubWVudC4ifX0sImlzc3VlciI6eyJpZCI6ImRpZDp3ZWI6bGF1bmNocGFkLnZpaS5lbGVjdHJvbi5tYXR0cmxhYnMuaW8iLCJuYW1lIjoiRXhhbXBsZSBVbml2ZXJzaXR5IiwiaWNvblVybCI6Imh0dHBzOi8vdzNjLWNjZy5naXRodWIuaW8vdmMtZWQvcGx1Z2Zlc3QtMS0yMDIyL2ltYWdlcy9KRkZfTG9nb0xvY2t1cC5wbmciLCJpbWFnZSI6Imh0dHBzOi8vdzNjLWNjZy5naXRodWIuaW8vdmMtZWQvcGx1Z2Zlc3QtMS0yMDIyL2ltYWdlcy9KRkZfTG9nb0xvY2t1cC5wbmcifX19.HUYvivfEH2-yBXUq6t5gEZu1NY7_6tjsWojQvYbpRL_md5TyAmwn-LyfcPLyrQpgJcu08XjFp8smXFMfYJEqCQ'
    //     ),
    //   })
    // see https://github.com/hyperledger/aries-framework-javascript/pull/1604#discussion_r1376347318
    // const key = await op.wallet.createKey({
    //   keyType: KeyType.Ed25519,
    //   privateKey: TypedArrayEncoder.fromString('00000000000000000000000000000000'),
    // })
    // const did = new DidKey(key)
    //   await agent.dids.import({
    //     did: 'did:key:z6MktqtXNG8CDUY9PrrtoStFzeCnhpMmgxYL1gikcW3BzvNW',
    //   })
    //   const openId4VpHolderService = agent.dependencyManager.resolve(OpenId4VpHolderService)
    //   const { selectResults, verifiedAuthorizationRequest } =
    //     await openId4VpHolderService.selectCredentialForProofRequest(agent.context, {
    //       authorizationRequest:
    //         'openid4vp://authorize?client_id=https%3A%2F%2Flaunchpad.mattrlabs.com%2Fapi%2Fvp%2Fcallback&client_id_scheme=redirect_uri&response_uri=https%3A%2F%2Flaunchpad.mattrlabs.com%2Fapi%2Fvp%2Fcallback&response_type=vp_token&response_mode=direct_post&presentation_definition_uri=https%3A%2F%2Flaunchpad.mattrlabs.com%2Fapi%2Fvp%2Frequest%3Fstate%3D9b2nQuoLQkW0bX_vk24qjg&nonce=u-Wg1dR5wo5IqIr8ilshMQ&state=9b2nQuoLQkW0bX_vk24qjg',
    //     })
    //   if (!selectResults.areRequirementsSatisfied) {
    //     throw new Error('Requirements are not satisfied.')
    //   }
    //   const credentialRecords = selectResults.requirements
    //     .flatMap((requirement) => requirement.submission.flatMap((submission) => submission.verifiableCredentials))
    //     .filter((credentialRecord): credentialRecord is W3cCredentialRecord => credentialRecord !== undefined)
    //   const credentials = credentialRecords.map((credentialRecord) => credentialRecord.credential)
    //   //await openId4VpHolderService.shareProof(agent.context, {
    //   //  verifiedAuthorizationRequest,
    //   //  selectedCredentials: credentials,
    //   //})
    // })

    xit('test against sphereon itself', async () => {
      const clientMetadata = {
        subject_syntax_types_supported: getSupportedDidMethods(rp.context),
        responseTypesSupported: [ResponseType.ID_TOKEN],
        scopesSupported: [Scope.OPENID],
        subjectTypesSupported: [SubjectType.PAIRWISE],
        idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA, SigningAlgo.ES256],
        requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA, SigningAlgo.ES256],
        passBy: PassBy.VALUE,
      }

      //////////////////////////// RP (create request) ////////////////////////////
      const { authorizationRequestUri, relyingParty } = await rp.modules.openId4VcHolder.createRequest({
        verificationMethod: rpVerificationMethod,
        redirect_url: 'https://acme.com/hello',
        // TODO: if provided this way client metadata is not resolved vor the verification method
        clientMetadata: clientMetadata,
      })

      //////////////////////////// OP (validate and parse the request) ////////////////////////////
      const result = await op.modules.openId4VcHolder.resolveRequest(authorizationRequestUri)

      //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////
      // TODO: User interaction

      //////////////////////////// OP (accept the verified request) ////////////////////////////
      const authRespWithJWT = await op.modules.openId4VcHolder.acceptRequest(result, opVerificationMethod)

      //////////////////////////// RP (verify the response) ////////////////////////////
      const verifiedAuthResponseWithJWT = await relyingParty.verifyAuthorizationResponse(
        authRespWithJWT.response.payload,
        {
          audience: 'https://acme.com/hello',
        }
      )

      expect(verifiedAuthResponseWithJWT.idToken).toBeDefined()
      expect(verifiedAuthResponseWithJWT.idToken?.payload.state).toMatch('b32f0087fc9816eb813fd11f')
      expect(verifiedAuthResponseWithJWT.idToken?.payload.nonce).toMatch('qBrR7mqnY3Qr49dAZycPF8FzgE83m6H0c2l0bzP4xSg')
    })
  })

  it('jajaja', async () => {
    nock('https://helloworld').get('/.well-known/openid-configuration').reply(200, staticOpSiopConfig)

    //////////////////////////// RP (create request) ////////////////////////////
    const { authorizationRequestUri, relyingParty } = await rp.modules.openId4VcHolder.createRequest({
      verificationMethod: rpVerificationMethod,
      redirect_url: 'https://acme.com/hello',
      // TODO: if provided this way client metadata is not resolved vor the verification method
      // TODO: rename to verifierMetadata?
      clientMetadata: {
        passBy: PassBy.REFERENCE,
        reference_uri: 'https://helloworld/.well-known/openid-configuration',
      },
    })

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await op.modules.openId4VcHolder.resolveRequest(authorizationRequestUri)

    //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////
    // TODO: User interaction

    //////////////////////////// OP (accept the verified request) ////////////////////////////
    const authRespWithJWT = await op.modules.openId4VcHolder.acceptRequest(result, opVerificationMethod)

    //////////////////////////// RP (verify the response) ////////////////////////////
    const verifiedAuthResponseWithJWT = await relyingParty.verifyAuthorizationResponse(
      authRespWithJWT.response.payload,
      {
        audience: 'https://acme.com/hello',
      }
    )

    expect(verifiedAuthResponseWithJWT.idToken).toBeDefined()
    expect(verifiedAuthResponseWithJWT.idToken?.payload.state).toMatch('b32f0087fc9816eb813fd11f')
    expect(verifiedAuthResponseWithJWT.idToken?.payload.nonce).toMatch('qBrR7mqnY3Qr49dAZycPF8FzgE83m6H0c2l0bzP4xSg')
  })
})
