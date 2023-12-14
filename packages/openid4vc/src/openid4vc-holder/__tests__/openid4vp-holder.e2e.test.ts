import type { AgentType } from '../../../tests/utils'
import type { CreateProofRequestOptions } from '../../openid4vc-verifier'
import type { Express } from 'express'
import type { Server } from 'http'

import { AskarModule } from '@aries-framework/askar'
import { W3cJwtVerifiableCredential } from '@aries-framework/core'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import express, { Router } from 'express'
import nock from 'nock'

import { OpenId4VcHolderModule } from '..'
import { createAgentFromModules } from '../../../tests/utils'
import {
  openBadgeCredentialPresentationDefinitionLdpVc,
  combinePresentationDefinitions,
  getOpenBadgeCredentialLdpVc,
  openBadgePresentationDefinition,
  staticOpOpenIdConfigEdDSA,
  universityDegreePresentationDefinition,
  waitForMockFunction,
  waltPortalOpenBadgeJwt,
  waltUniversityDegreeJwt,
} from '../../../tests/utilsVp'
import { OpenId4VcVerifierModule } from '../../openid4vc-verifier'

const port = 3121
const verificationEndpointPath = '/proofResponse'
const verifierBaseUrl = `http://localhost:${port}`

const holderModules = {
  openId4VcHolder: new OpenId4VcHolderModule(),
  askar: new AskarModule({ ariesAskar }),
}

const verifierModules = {
  openId4VcVerifier: new OpenId4VcVerifierModule({
    verifierMetadata: {
      verifierBaseUrl: verifierBaseUrl,
      verificationEndpointPath,
    },
  }),

  askar: new AskarModule({ ariesAskar }),
}

describe('OpenId4VcHolder | OpenID4VP', () => {
  let verifier: AgentType<typeof verifierModules>
  let holder: AgentType<typeof holderModules>
  let verifierApp: Express
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let verifierServer: Server<any, any>

  const mockFunction = jest.fn()
  mockFunction.mockReturnValue({ status: 200 })

  beforeEach(async () => {
    verifier = await createAgentFromModules('verifier', verifierModules, '96213c3d7fc8d4d6754c7a0fd969598f')
    holder = await createAgentFromModules('holder', holderModules, '96213c3d7fc8d4d6754c7a0fd969598e')
    verifierApp = express()

    const router = await verifier.agent.modules.openId4VcVerifier.configureRouter(Router(), {
      basePath: '/',
      verificationEndpointConfig: {
        enabled: true,
        proofResponseHandler: mockFunction,
      },
    })

    verifierApp.use('/', router)

    verifierServer = verifierApp.listen(port)
  })

  afterEach(async () => {
    verifierServer?.close()
    await holder.agent.shutdown()
    await holder.agent.wallet.delete()
    await verifier.agent.shutdown()
    await verifier.agent.wallet.delete()
  })

  it('siop request with static metadata', async () => {
    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
    }

    //////////////////////////// RP (create request) ////////////////////////////
    const { proofRequest, proofRequestMetadata } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)

    //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////

    if (result.proofType == 'presentation') throw new Error('Expected an authenticationRequest')

    //////////////////////////// OP (accept the verified request) ////////////////////////////
    const { submittedResponse, status } = await holder.agent.modules.openId4VcHolder.acceptAuthenticationRequest(
      result.authenticationRequest,
      holder.verificationMethod
    )

    expect(status).toBe(200)

    expect(result.authenticationRequest.authorizationRequestPayload.redirect_uri).toBe(
      verifierBaseUrl + verificationEndpointPath
    )
    expect(result.authenticationRequest.issuer).toBe(verifier.verificationMethod.controller)

    //////////////////////////// RP (verify the response) ////////////////////////////

    const { idTokenPayload, submission } = await verifier.agent.modules.openId4VcVerifier.verifyProofResponse(
      submittedResponse
    )

    const { state, challenge } = proofRequestMetadata
    expect(submission).toBe(undefined)
    expect(idTokenPayload).toBeDefined()
    expect(idTokenPayload.state).toMatch(state)
    expect(idTokenPayload.nonce).toMatch(challenge)

    await waitForMockFunction(mockFunction)
    expect(mockFunction).toBeCalledWith({
      idTokenPayload: expect.objectContaining(idTokenPayload),
      submission: undefined,
    })
  })

  // TODO: not working yet
  xit('siop request with issuer', async () => {
    nock('https://helloworld.com')
      .get('/.well-known/openid-configuration')
      .reply(200, staticOpOpenIdConfigEdDSA)
      .get('/.well-known/openid-configuration')
      .reply(200, staticOpOpenIdConfigEdDSA)
      .get('/.well-known/openid-configuration')
      .reply(200, staticOpOpenIdConfigEdDSA)
      .get('/.well-known/openid-configuration')
      .reply(200, staticOpOpenIdConfigEdDSA)

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      // TODO: if provided this way client metadata is not resolved for the verification method
      holderMetadata: 'https://helloworld.com',
    }

    //////////////////////////// RP (create request) ////////////////////////////
    const { proofRequest, proofRequestMetadata } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)

    //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////

    if (result.proofType == 'presentation') throw new Error('Expected a proofType')

    //////////////////////////// OP (accept the verified request) ////////////////////////////
    const { submittedResponse, status } = await holder.agent.modules.openId4VcHolder.acceptAuthenticationRequest(
      result.authenticationRequest,
      holder.verificationMethod
    )

    expect(status).toBe(200)

    //////////////////////////// RP (verify the response) ////////////////////////////

    const { idTokenPayload, submission } = await verifier.agent.modules.openId4VcVerifier.verifyProofResponse(
      submittedResponse
    )

    const { state, challenge } = proofRequestMetadata
    expect(idTokenPayload).toBeDefined()
    expect(idTokenPayload.state).toMatch(state)
    expect(idTokenPayload.nonce).toMatch(challenge)

    await waitForMockFunction(mockFunction)
    expect(mockFunction).toBeCalledWith({
      idTokenPayload: expect.objectContaining(idTokenPayload),
      submission: expect.objectContaining(submission),
    })
  })

  it('resolving vp request with no credentials', async () => {
    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const { proofRequest } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    expect(result.presentationSubmission.areRequirementsSatisfied).toBeFalsy()
    expect(result.presentationSubmission.requirements.length).toBe(1)
  })

  it('resolving vp request with wrong credentials errors', async () => {
    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltUniversityDegreeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const { proofRequest } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    expect(result.presentationSubmission.areRequirementsSatisfied).toBeFalsy()
    expect(result.presentationSubmission.requirements.length).toBe(1)
  })

  it('expect submitting a wrong submission to fail', async () => {
    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltUniversityDegreeJwt),
    })

    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const { proofRequest: openBadge } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )
    const { proofRequest: university } = await verifier.agent.modules.openId4VcVerifier.createProofRequest({
      ...createProofRequestOptions,
      presentationDefinition: universityDegreePresentationDefinition,
    })

    //////////////////////////// OP (validate and parse the request) ////////////////////////////

    const resolvedOpenBadge = await holder.agent.modules.openId4VcHolder.resolveProofRequest(openBadge)
    const resolvedUniversityDegree = await holder.agent.modules.openId4VcHolder.resolveProofRequest(university)
    if (resolvedOpenBadge.proofType !== 'presentation') throw new Error('expected prooftype presentation')
    if (resolvedUniversityDegree.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    await expect(
      holder.agent.modules.openId4VcHolder.acceptPresentationRequest(resolvedOpenBadge.presentationRequest, {
        submission: resolvedUniversityDegree.presentationSubmission,
        submissionEntryIndexes: [0],
      })
    ).rejects.toThrow()
  })

  it('resolving vp request with multiple credentials in wallet only allows selecting the correct ones', async () => {
    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltUniversityDegreeJwt),
    })

    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const { proofRequest } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////

    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    const { presentationRequest, presentationSubmission } = result
    expect(presentationSubmission.areRequirementsSatisfied).toBeTruthy()
    expect(presentationSubmission.requirements.length).toBe(1)
    expect(presentationSubmission.requirements[0].needsCount).toBe(1)
    expect(presentationSubmission.requirements[0].submissionEntry.length).toBe(1)
    expect(presentationSubmission.requirements[0].submissionEntry[0].inputDescriptorId).toBe('OpenBadgeCredential')

    expect(presentationRequest.presentationDefinitions[0].definition).toMatchObject(openBadgePresentationDefinition)
  })

  it('resolving vp request with multiple credentials in wallet select the correct credentials from the wallet', async () => {
    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltUniversityDegreeJwt),
    })

    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: combinePresentationDefinitions([
        openBadgePresentationDefinition,
        universityDegreePresentationDefinition,
      ]),
    }

    const { proofRequest } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////

    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    const { presentationSubmission } = result
    expect(presentationSubmission.areRequirementsSatisfied).toBeTruthy()
    expect(presentationSubmission.requirements.length).toBe(2)
    expect(presentationSubmission.requirements[0].needsCount).toBe(1)
    expect(presentationSubmission.requirements[0].submissionEntry.length).toBe(1)
    expect(presentationSubmission.requirements[1].needsCount).toBe(1)
    expect(presentationSubmission.requirements[1].submissionEntry.length).toBe(1)
    expect(presentationSubmission.requirements[0].submissionEntry[0].inputDescriptorId).toBe('OpenBadgeCredential')
    expect(presentationSubmission.requirements[1].submissionEntry[0].inputDescriptorId).toBe('UniversityDegree')

    const { submittedResponse, status } = await holder.agent.modules.openId4VcHolder.acceptPresentationRequest(
      result.presentationRequest,
      {
        submission: result.presentationSubmission,
        submissionEntryIndexes: [0, 0],
      }
    )

    expect(status).toBe(200)

    const { idTokenPayload, submission } = await verifier.agent.modules.openId4VcVerifier.verifyProofResponse(
      submittedResponse
    )

    expect(idTokenPayload).toBeDefined()
    expect(submission).toBeDefined()
    expect(submission?.presentationDefinitions).toHaveLength(1)
    expect(submission?.submissionData.definition_id).toBe('Combined')
    expect(submission?.presentations).toHaveLength(1)
    expect(submission?.presentations[0].vcs).toHaveLength(2)

    if (submission?.presentations[0].vcs[0].credential.type.includes('OpenBadgeCredential')) {
      expect(submission?.presentations[0].vcs[0].credential.type).toEqual([
        'VerifiableCredential',
        'OpenBadgeCredential',
      ])
      expect(submission?.presentations[0].vcs[1].credential.type).toEqual([
        'VerifiableCredential',
        'UniversityDegreeCredential',
      ])
    } else {
      expect(submission?.presentations[0].vcs[1].credential.type).toEqual([
        'VerifiableCredential',
        'OpenBadgeCredential',
      ])
      expect(submission?.presentations[0].vcs[0].credential.type).toEqual([
        'VerifiableCredential',
        'UniversityDegreeCredential',
      ])
    }

    await waitForMockFunction(mockFunction)
    expect(mockFunction).toBeCalledWith({
      idTokenPayload: expect.objectContaining(idTokenPayload),
      submission: expect.objectContaining(submission),
    })
  })

  it('expect accepting a proof request with only a partial set of requirements to error', async () => {
    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltUniversityDegreeJwt),
    })

    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: combinePresentationDefinitions([
        openBadgePresentationDefinition,
        universityDegreePresentationDefinition,
      ]),
    }

    const { proofRequest } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////

    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType !== 'presentation') throw new Error('expected prooftype presentation')

    await expect(
      holder.agent.modules.openId4VcHolder.acceptPresentationRequest(result.presentationRequest, {
        submission: result.presentationSubmission,
        submissionEntryIndexes: [0],
      })
    ).rejects.toThrow()
  })

  it('expect vp request with single requested credential to succeed', async () => {
    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const { proofRequest, proofRequestMetadata } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType === 'authentication') throw new Error('Expected a proofRequest')

    //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////
    // Select the appropriate credentials

    result.presentationSubmission.requirements[0]

    if (!result.presentationSubmission.areRequirementsSatisfied) {
      throw new Error('Requirements are not satisfied.')
    }

    //////////////////////////// OP (accept the verified request) ////////////////////////////
    const { submittedResponse, status } = await holder.agent.modules.openId4VcHolder.acceptPresentationRequest(
      result.presentationRequest,
      {
        submission: result.presentationSubmission,
        submissionEntryIndexes: [0],
      }
    )

    expect(status).toBe(200)

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const { idTokenPayload, submission } = await verifier.agent.modules.openId4VcVerifier.verifyProofResponse(
      submittedResponse
    )

    const { state, challenge } = proofRequestMetadata
    expect(idTokenPayload).toBeDefined()
    expect(idTokenPayload.state).toMatch(state)
    expect(idTokenPayload.nonce).toMatch(challenge)

    expect(submission).toBeDefined()
    expect(submission?.presentationDefinitions).toHaveLength(1)
    expect(submission?.submissionData.definition_id).toBe('OpenBadgeCredential')
    expect(submission?.presentations).toHaveLength(1)
    expect(submission?.presentations[0].vcs[0].credential.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential'])

    await waitForMockFunction(mockFunction)
    expect(mockFunction).toBeCalledWith({
      idTokenPayload: expect.objectContaining(idTokenPayload),
      submission: expect.objectContaining(submission),
    })
  })

  it('expect vp request with single requested ldp_vc credential to succeed', async () => {
    const credential = await getOpenBadgeCredentialLdpVc(
      verifier.agent.context,
      verifier.verificationMethod,
      holder.verificationMethod
    )
    await holder.agent.w3cCredentials.storeCredential({
      credential,
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgeCredentialPresentationDefinitionLdpVc,
    }

    const { proofRequest, proofRequestMetadata } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType === 'authentication') throw new Error('Expected a proofRequest')

    //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////
    // Select the appropriate credentials

    if (!result.presentationSubmission.areRequirementsSatisfied) {
      throw new Error('Requirements are not satisfied.')
    }

    //////////////////////////// OP (accept the verified request) ////////////////////////////
    const { submittedResponse, status } = await holder.agent.modules.openId4VcHolder.acceptPresentationRequest(
      result.presentationRequest,
      {
        submission: result.presentationSubmission,
        submissionEntryIndexes: [0],
      }
    )

    expect(status).toBe(200)

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const { idTokenPayload, submission } = await verifier.agent.modules.openId4VcVerifier.verifyProofResponse(
      submittedResponse
    )

    const { state, challenge } = proofRequestMetadata
    expect(idTokenPayload).toBeDefined()
    expect(idTokenPayload.state).toMatch(state)
    expect(idTokenPayload.nonce).toMatch(challenge)

    expect(submission).toBeDefined()
    expect(submission?.presentationDefinitions).toHaveLength(1)
    expect(submission?.submissionData.definition_id).toBe('OpenBadgeCredential')
    expect(submission?.presentations).toHaveLength(1)
    expect(submission?.presentations[0].vcs[0].credential.type).toEqual(['VerifiableCredential', 'OpenBadgeCredential'])

    await waitForMockFunction(mockFunction)
    expect(mockFunction).toBeCalledWith({
      idTokenPayload: expect.objectContaining(idTokenPayload),
      submission: expect.objectContaining(submission),
    })
  })

  it('expects the submission to fail if there are too few submission entry indexes, and also to fail when requesting two different presentation formats', async () => {
    const credential = await getOpenBadgeCredentialLdpVc(
      verifier.agent.context,
      verifier.verificationMethod,
      holder.verificationMethod
    )

    await holder.agent.w3cCredentials.storeCredential({ credential })

    await holder.agent.w3cCredentials.storeCredential({
      credential: W3cJwtVerifiableCredential.fromSerializedJwt(waltUniversityDegreeJwt),
    })

    const createProofRequestOptions: CreateProofRequestOptions = {
      verificationMethod: verifier.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: combinePresentationDefinitions([
        universityDegreePresentationDefinition,
        openBadgeCredentialPresentationDefinitionLdpVc,
      ]),
    }

    const { proofRequest } = await verifier.agent.modules.openId4VcVerifier.createProofRequest(
      createProofRequestOptions
    )

    //////////////////////////// OP (validate and parse the request) ////////////////////////////
    const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(proofRequest)
    if (result.proofType === 'authentication') throw new Error('Expected a proofRequest')

    //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////
    // Select the appropriate credentials

    if (!result.presentationSubmission.areRequirementsSatisfied) {
      throw new Error('Requirements are not satisfied.')
    }

    //////////////////////////// OP (accept the verified request) ////////////////////////////
    await expect(
      holder.agent.modules.openId4VcHolder.acceptPresentationRequest(result.presentationRequest, {
        submission: result.presentationSubmission,
        submissionEntryIndexes: [0, 0],
      })
    ).rejects.toThrow()

    await expect(
      holder.agent.modules.openId4VcHolder.acceptPresentationRequest(result.presentationRequest, {
        submission: result.presentationSubmission,
        submissionEntryIndexes: [0],
      })
    ).rejects.toThrow()
  })

  // it('edited walt vp request', async () => {
  //   const credential = W3cJwtVerifiableCredential.fromSerializedJwt(waltPortalOpenBadgeJwt)
  //   await holder.w3cCredentials.storeCredential({ credential })

  //   const authorizationRequestUri =
  //     'openid4vp://authorize?response_type=vp_token&client_id=https%3A%2F%2Fverifier.portal.walt.id%2Fopenid4vc%2Fverify&response_mode=direct_post&state=97509d5c-2dd2-490b-8617-577f45e3b6d0&presentation_definition=%7B%22id%22%3A%22test%22%2C%22input_descriptors%22%3A%5B%7B%22id%22%3A%22OpenBadgeCredential%22%2C%22format%22%3A%7B%22jwt_vc%22%3A%7B%22alg%22%3A%5B%22EdDSA%22%5D%7D%7D%2C%22constraints%22%3A%7B%22fields%22%3A%5B%7B%22path%22%3A%5B%22%24.vc.type.%2A%22%5D%2C%22filter%22%3A%7B%22type%22%3A%22string%22%2C%22pattern%22%3A%22OpenBadgeCredential%22%7D%7D%5D%7D%7D%5D%7D&client_id_scheme=redirect_uri&response_uri=https%3A%2F%2Fverifier.portal.walt.id%2Fopenid4vc%2Fverify%2F97509d5c-2dd2-490b-8617-577f45e3b6d0'

  //   //////////////////////////// OP (validate and parse the request) ////////////////////////////
  //   const result = await holder.agent.modules.openId4VcHolder.resolveProofRequest(authorizationRequestUri)
  //   if (result.proofType === 'authentication') throw new Error('Expected a proofRequest')

  //   //////////////////////////// User (decide wheather or not to accept the request) ////////////////////////////
  //   // Select the appropriate credentials

  //   const { presentationRequest, selectResults } = result
  //   result.selectResults.requirements[0]

  //   if (!result.selectResults.areRequirementsSatisfied) {
  //     throw new Error('Requirements are not satisfied.')
  //   }

  //   //////////////////////////// OP (accept the verified request) ////////////////////////////
  //   const responseStatus = await holder.agent.modules.openId4VcHolder.acceptPresentationRequest(presentationRequest, {
  //     submission: selectResults,
  //     submissionEntryIndexes: [0],
  //   })

  //   expect(responseStatus.ok).toBeTruthy()
  // })
})
