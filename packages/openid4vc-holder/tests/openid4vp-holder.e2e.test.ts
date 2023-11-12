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

    const { idTokenPayload, submission } = await verifier.modules.openId4VcVerifier.verifyProofResponse(
      submittedResponse,
      {
        createProofRequestOptions,
        proofRequestMetadata,
      }
    )

    const { state, challenge } = proofRequestMetadata
    expect(submission).toBe(undefined)
    expect(idTokenPayload).toBeDefined()
    expect(idTokenPayload.state).toMatch(state)
    expect(idTokenPayload.nonce).toMatch(challenge)
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

  it('expect submitting a wrong submission to fail', async () => {
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

    const { proofRequest: openBadge } = await verifier.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )
    const { proofRequest: university } = await verifier.modules.openId4VcVerifier.createProofRequest({
      ...createProofRequestOptions,
      presentationDefinition: universityDegreePresentationDefinition,
    })

    //////////////////////////// OP (validate and parse the request) ////////////////////////////

    const resolvedOpenBadge = await holder.modules.openId4VcHolder.resolveProofRequest(openBadge)
    const resolvedUniversityDegree = await holder.modules.openId4VcHolder.resolveProofRequest(university)
    if (resolvedOpenBadge.proofType !== 'presentation') throw new Error('expected prooftype presentation')
    if (resolvedUniversityDegree.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    await expect(
      holder.modules.openId4VcHolder.acceptPresentationRequest(resolvedOpenBadge.presentationRequest, {
        submission: resolvedUniversityDegree.selectResults,
        submissionEntryIndexes: [0],
      })
    ).rejects.toThrow()
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
