import type { KeyDidCreateOptions, VerificationMethod } from '@aries-framework/core'
import type { CreateProofRequestOptions } from '@aries-framework/openid4vc-verifier'
import type { PresentationDefinitionV2 } from '@sphereon/pex-models'

import { AskarModule } from '@aries-framework/askar'
import { KeyType, Agent, TypedArrayEncoder, DidKey, W3cJwtVerifiableCredential } from '@aries-framework/core'
import { agentDependencies } from '@aries-framework/node'
import { OpenId4VcVerifierModule, staticOpOpenIdConfig } from '@aries-framework/openid4vc-verifier'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import { SigningAlgo } from '@sphereon/did-auth-siop'
import nock from 'nock'

import { OpenId4VcHolderModule } from '../src'

import { waltPortalOpenBadgeJwt, waltUniversityDegreeJwt } from './fixtures_vp'

// id id%22%3A%22test%22%2C%22
// * = %2A
// TODO: error on sphereon lib PR opened
// TODO: walt issued credentials verification fails due to some time issue || //throw new Error(`Inconsistent issuance dates between JWT claim (${nbfDateAsStr}) and VC value (${issuanceDate})`);
// TODO: error walt no id in presentation definition
// TODO: error walt vc.type is an array not a string thus the filter does not work $.type (should be array according to vc data 1.1)
// TODO: jwt_vc vs jwt_vc_json

const universityDegreePresentationDefinition: PresentationDefinitionV2 = {
  id: 'UniversityDegreeCredential',
  input_descriptors: [
    {
      id: 'UniversityDegree',
      // changed jwt_vc_json to jwt_vc
      format: { jwt_vc: { alg: ['EdDSA'] } },
      // changed $.type to $.vc.type
      constraints: {
        fields: [{ path: ['$.vc.type.*'], filter: { type: 'string', pattern: 'UniversityDegree' } }],
      },
    },
  ],
}

const openBadgePresentationDefinition: PresentationDefinitionV2 = {
  id: 'OpenBadgeCredential',
  input_descriptors: [
    {
      id: 'OpenBadgeCredential',
      // changed jwt_vc_json to jwt_vc
      format: { jwt_vc: { alg: ['EdDSA'] } },
      // changed $.type to $.vc.type
      constraints: {
        fields: [{ path: ['$.vc.type.*'], filter: { type: 'string', pattern: 'OpenBadgeCredential' } }],
      },
    },
  ],
}

const combinePresentationDefinitions = (
  presentationDefinitions: PresentationDefinitionV2[]
): PresentationDefinitionV2 => {
  return {
    id: 'Combined',
    input_descriptors: presentationDefinitions.flatMap((p) => p.input_descriptors),
  }
}

const staticOpOpenIdConfigEdDSA = {
  ...staticOpOpenIdConfig,
  idTokenSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  requestObjectSigningAlgValuesSupported: [SigningAlgo.EDDSA],
  vpFormatsSupported: { jwt_vc: { alg: [SigningAlgo.EDDSA] }, jwt_vp: { alg: [SigningAlgo.EDDSA] } },
}

const modules = {
  openId4VcHolder: new OpenId4VcHolderModule(),
  openId4VcVerifier: new OpenId4VcVerifierModule(),
  askar: new AskarModule({ ariesAskar }),
}

describe('OpenId4VcHolder | OpenID4VP', () => {
  let verifier: Agent<typeof modules>
  let verifierVerificationMethod: VerificationMethod

  let holder: Agent<typeof modules>
  let holderVerificationMethod: VerificationMethod

  beforeEach(async () => {
    verifier = new Agent({
      config: {
        label: 'OpenId4VcRp OpenID4VP Test36',
        walletConfig: {
          id: 'openid4vc-rp-openid4vp-test37',
          key: 'openid4vc-rp-openid4vp-test38',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    holder = new Agent({
      config: {
        label: 'OpenId4VcOp OpenID4VP Test37',
        walletConfig: {
          id: 'openid4vc-op-openid4vp-test38',
          key: 'openid4vc-op-openid4vp-test39',
        },
      },
      dependencies: agentDependencies,
      modules,
    })

    await verifier.initialize()
    await holder.initialize()

    const verifierDid = await verifier.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598f') },
    })

    const verifierDidKey = DidKey.fromDid(verifierDid.didState.did as string)
    const verifierKid = `${verifierDid.didState.did as string}#${verifierDidKey.key.fingerprint}`
    const _verifierVerificationMethod = verifierDid.didState.didDocument?.dereferenceKey(verifierKid, [
      'authentication',
    ])
    if (!_verifierVerificationMethod) throw new Error('No verification method found')
    verifierVerificationMethod = _verifierVerificationMethod

    const holderDid = await holder.dids.create<KeyDidCreateOptions>({
      method: 'key',
      options: { keyType: KeyType.Ed25519 },
      secret: { privateKey: TypedArrayEncoder.fromString('96213c3d7fc8d4d6754c7a0fd969598e') },
    })

    const holderDidKey = DidKey.fromDid(holderDid.didState.did as string)
    const holderKid = `${holderDid.didState.did as string}#${holderDidKey.key.fingerprint}`
    const _holderVerificationMethod = holderDid.didState.didDocument?.dereferenceKey(holderKid, ['authentication'])
    if (!_holderVerificationMethod) throw new Error('No verification method found')
    holderVerificationMethod = _holderVerificationMethod
  })

  afterEach(async () => {
    await holder.shutdown()
    await holder.wallet.delete()
    await verifier.shutdown()
    await verifier.wallet.delete()
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
  })

  it('siop request with static metadata', async () => {
    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifierVerificationMethod,
      redirectUri: 'https://acme.com/hello',
      holderClientMetadata: staticOpOpenIdConfigEdDSA,
    }

    //////////////////////////// RP (create request) ////////////////////////////
    const { proofRequest, proofRequestMetadata } = await verifier.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.modules.openId4VcHolder.resolveProofRequest(proofRequest)

    //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////

    if (result.proofType == 'presentation') throw new Error('Expected an authenticationRequest')

    //////////////////////////// OP (accept the verified request) ////////////////////////////
    const { submittedResponse } = await holder.modules.openId4VcHolder.acceptAuthenticationRequest(
      result.authenticationRequest,
      holderVerificationMethod
    )

    //////////////////////////// RP (verify the response) ////////////////////////////

    const verifiedAuthResponseWithJWT = await verifier.modules.openId4VcVerifier.verifyProofResponse(
      submittedResponse,
      {
        createProofRequestOptions,
        proofRequestMetadata,
      }
    )

    const { state, challenge } = proofRequestMetadata
    expect(verifiedAuthResponseWithJWT.idTokenPayload).toBeDefined()
    expect(verifiedAuthResponseWithJWT.idTokenPayload.state).toMatch(state)
    expect(verifiedAuthResponseWithJWT.idTokenPayload.nonce).toMatch(challenge)
  })

  const getConfig = () => {
    return staticOpOpenIdConfigEdDSA
  }

  // TODO: not working yet
  xit('siop request with issuer', async () => {
    nock('https://helloworld.com')
      .get('/.well-known/openid-configuration')
      .reply(200, getConfig())
      .get('/.well-known/openid-configuration')
      .reply(200, getConfig())
      .get('/.well-known/openid-configuration')
      .reply(200, getConfig())
      .get('/.well-known/openid-configuration')
      .reply(200, getConfig())

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifierVerificationMethod,
      redirectUri: 'https://acme.com/hello',
      // TODO: if provided this way client metadata is not resolved for the verification method
      issuer: 'https://helloworld.com',
    }

    //////////////////////////// RP (create request) ////////////////////////////
    const { proofRequest, proofRequestMetadata } = await verifier.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.modules.openId4VcHolder.resolveProofRequest(proofRequest)

    //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////

    if (result.proofType == 'presentation') throw new Error('Expected a proofType')

    //////////////////////////// OP (accept the verified request) ////////////////////////////
    const { submittedResponse } = await holder.modules.openId4VcHolder.acceptAuthenticationRequest(
      result.authenticationRequest,
      holderVerificationMethod
    )

    //////////////////////////// RP (verify the response) ////////////////////////////

    const verifiedProofPresponse = await verifier.modules.openId4VcVerifier.verifyProofResponse(submittedResponse, {
      createProofRequestOptions,
      proofRequestMetadata,
    })

    const { state, challenge } = proofRequestMetadata
    expect(verifiedProofPresponse.idTokenPayload).toBeDefined()
    expect(verifiedProofPresponse.idTokenPayload.state).toMatch(state)
    expect(verifiedProofPresponse.idTokenPayload.nonce).toMatch(challenge)
  })

  it('resolving vp request with no credentials', async () => {
    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifierVerificationMethod,
      redirectUri: 'https://acme.com/hello',
      holderClientMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const { proofRequest } = await verifier.modules.openId4VcVerifier.createProofRequest(createProofRequestOptions)

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    expect(result.selectResults.areRequirementsSatisfied).toBeFalsy()
    expect(result.selectResults.requirements.length).toBe(1)
  })

  it('resolving vp request with wrong credentials errors', async () => {
    await holder.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltUniversityDegreeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifierVerificationMethod,
      redirectUri: 'https://acme.com/hello',
      holderClientMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const { proofRequest } = await verifier.modules.openId4VcVerifier.createProofRequest(createProofRequestOptions)

    const result = await holder.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    expect(result.selectResults.areRequirementsSatisfied).toBeFalsy()
    expect(result.selectResults.requirements.length).toBe(1)
  })

  it('resolving vp request with multiple credentials in wallet only allows selecting the correct ones', async () => {
    await holder.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltUniversityDegreeJwt),
    })

    await holder.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifierVerificationMethod,
      redirectUri: 'https://acme.com/hello',
      holderClientMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const { proofRequest } = await verifier.modules.openId4VcVerifier.createProofRequest(createProofRequestOptions)

    //////////////////////////// OP (validate and parse the request) ////////////////////////////

    const result = await holder.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    const { presentationRequest, selectResults } = result
    expect(selectResults.areRequirementsSatisfied).toBeTruthy()
    expect(selectResults.requirements.length).toBe(1)
    expect(selectResults.requirements[0].needsCount).toBe(1)
    expect(selectResults.requirements[0].submissionEntry.length).toBe(1)
    expect(selectResults.requirements[0].submissionEntry[0].inputDescriptorId).toBe('OpenBadgeCredential')

    expect(presentationRequest.presentationDefinitions[0].definition).toMatchObject(openBadgePresentationDefinition)
  })

  it('resolving vp request with multiple credentials in wallet select the correct credentials from the wallet', async () => {
    await holder.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltUniversityDegreeJwt),
    })

    await holder.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifierVerificationMethod,
      redirectUri: 'https://acme.com/hello',
      holderClientMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: combinePresentationDefinitions([
        openBadgePresentationDefinition,
        universityDegreePresentationDefinition,
      ]),
    }

    const { proofRequest } = await verifier.modules.openId4VcVerifier.createProofRequest(createProofRequestOptions)

    //////////////////////////// OP (validate and parse the request) ////////////////////////////

    const result = await holder.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    const { selectResults } = result
    expect(selectResults.areRequirementsSatisfied).toBeTruthy()
    expect(selectResults.requirements.length).toBe(2)
    expect(selectResults.requirements[0].needsCount).toBe(1)
    expect(selectResults.requirements[0].submissionEntry.length).toBe(1)
    expect(selectResults.requirements[1].needsCount).toBe(1)
    expect(selectResults.requirements[1].submissionEntry.length).toBe(1)

    expect(selectResults.requirements[0].submissionEntry[0].inputDescriptorId).toBe('OpenBadgeCredential')

    expect(selectResults.requirements[1].submissionEntry[0].inputDescriptorId).toBe('UniversityDegree')
  })

  it('expect vp request with single requested credential to succeed', async () => {
    await holder.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifierVerificationMethod,
      redirectUri: 'https://acme.com/hello',
      holderClientMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const { proofRequest, proofRequestMetadata } = await verifier.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType === 'authentication') throw new Error('Expected a proofRequest')

    //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////
    // Select the appropriate credentials

    result.selectResults.requirements[0]

    if (!result.selectResults.areRequirementsSatisfied) {
      throw new Error('Requirements are not satisfied.')
    }

    //////////////////////////// OP (accept the verified request) ////////////////////////////
    const { submittedResponse, status } = await holder.modules.openId4VcHolder.acceptPresentationRequest(
      result.presentationRequest,
      {
        submission: result.selectResults,
        submissionEntryIndexes: [0],
      }
    )

    expect(status).toBe(404)

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const { idTokenPayload, submission } = await verifier.modules.openId4VcVerifier.verifyProofResponse(
      submittedResponse,
      {
        createProofRequestOptions,
        proofRequestMetadata,
      }
    )

    const { state, challenge } = proofRequestMetadata
    expect(idTokenPayload).toBeDefined()
    expect(idTokenPayload.state).toMatch(state)
    expect(idTokenPayload.nonce).toMatch(challenge)

    expect(submission).toBeDefined()
  })

  // it('edited walt vp request', async () => {
  //   const credential = W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt)
  //   await holder.w3cCredentials.storeCredential({ credential })

  //   const authorizationRequestUri =
  //     'openid4vp://authorize?response_type=vp_token&client_id=https%3A%2F%2Fverifier.portal.walt.id%2Fopenid4vc%2Fverify&response_mode=direct_post&state=97509d5c-2dd2-490b-8617-577f45e3b6d0&presentation_definition=%7B%22id%22%3A%22test%22%2C%22input_descriptors%22%3A%5B%7B%22id%22%3A%22OpenBadgeCredential%22%2C%22format%22%3A%7B%22jwt_vc%22%3A%7B%22alg%22%3A%5B%22EdDSA%22%5D%7D%7D%2C%22constraints%22%3A%7B%22fields%22%3A%5B%7B%22path%22%3A%5B%22%24.vc.type.%2A%22%5D%2C%22filter%22%3A%7B%22type%22%3A%22string%22%2C%22pattern%22%3A%22OpenBadgeCredential%22%7D%7D%5D%7D%7D%5D%7D&client_id_scheme=redirect_uri&response_uri=https%3A%2F%2Fverifier.portal.walt.id%2Fopenid4vc%2Fverify%2F97509d5c-2dd2-490b-8617-577f45e3b6d0'

  //   //////////////////////////// OP (validate and parse the request) ////////////////////////////
  //   const result = await holder.modules.openId4VcHolder.resolveProofRequest(authorizationRequestUri)
  //   if (result.proofType === 'authentication') throw new Error('Expected a proofRequest')

  //   //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////
  //   // Select the appropriate credentials

  //   const { presentationRequest, selectResults } = result
  //   result.selectResults.requirements[0]

  //   if (!result.selectResults.areRequirementsSatisfied) {
  //     throw new Error('Requirements are not satisfied.')
  //   }

  //   //////////////////////////// OP (accept the verified request) ////////////////////////////
  //   const responseStatus = await holder.modules.openId4VcHolder.acceptPresentationRequest(presentationRequest, {
  //     submission: selectResults,
  //     submissionEntryIndexes: [0],
  //   })

  //   expect(responseStatus.ok).toBeTruthy()
  // })
})
