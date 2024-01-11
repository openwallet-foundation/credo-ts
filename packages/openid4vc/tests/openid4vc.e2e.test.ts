import type { AgentType, TenantType } from './utils'
import type { CreateProofRequestOptions, CredentialBindingResolver } from '../src'
import type { SdJwtVc, SdJwtVcSignOptions } from '@aries-framework/sd-jwt-vc'
import type { Server } from 'http'

import { AskarModule } from '@aries-framework/askar'
import {
  ClaimFormat,
  JwaSignatureAlgorithm,
  W3cCredential,
  W3cCredentialService,
  W3cCredentialSubject,
  W3cIssuer,
  w3cDate,
  DidsApi,
  getKeyFromVerificationMethod,
  getJwkFromKey,
  AriesFrameworkError,
} from '@aries-framework/core'
import { SdJwtVcModule } from '@aries-framework/sd-jwt-vc'
import { TenantsModule } from '@aries-framework/tenants'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import express, { Router, type Express } from 'express'

import { askarModuleConfig } from '../../askar/tests/helpers'
import { OpenId4VcVerifierModule, OpenId4VcHolderModule, OpenId4VcIssuerModule } from '../src'

import { createAgentFromModules, createTenantForAgent } from './utils'
import { universityDegreeCredentialSdJwt, universityDegreeCredentialSdJwt2 } from './utilsVci'
import {
  openBadgePresentationDefinition,
  staticOpOpenIdConfigEdDSA,
  universityDegreePresentationDefinition,
  waitForMockFunction,
} from './utilsVp'

const issuerPort = 1234
const baseUrl = `http://localhost:${issuerPort}/oid4vci`

const baseCredentialOfferOptions = {
  scheme: 'openid-credential-offer',
  baseUri: baseUrl,
}

const holderModules = {
  openId4VcHolder: new OpenId4VcHolderModule(),
  sdJwtVc: new SdJwtVcModule(),
  askar: new AskarModule(askarModuleConfig),
} as const

const oid4vciRouter = Router()
const issuerModules = {
  openId4VcIssuer: new OpenId4VcIssuerModule({
    baseUrl,
    router: oid4vciRouter,
    endpoints: {
      credential: {
        // FIXME: should not be nested under the endpoint config, as it's also used for the non-endpoint part
        credentialRequestToCredentialMapper: async ({ agentContext, credentialRequest, holderBinding }) => {
          // We sign the request with the first did:key did we have
          const didsApi = agentContext.dependencyManager.resolve(DidsApi)
          const [firstDidKeyDid] = await didsApi.getCreatedDids({ method: 'key' })
          const didDocument = await didsApi.resolveDidDocument(firstDidKeyDid.did)
          const verificationMethod = didDocument.verificationMethod?.[0]
          if (!verificationMethod) {
            throw new Error('No verification method found')
          }

          if (credentialRequest.format === 'vc+sd-jwt') {
            return {
              payload: { vct: credentialRequest.vct, university: 'innsbruck', degree: 'bachelor' },
              holder: holderBinding,
              issuer: {
                method: 'did',
                didUrl: verificationMethod.id,
              },
              disclosureFrame: { university: true, degree: true },
            } satisfies SdJwtVcSignOptions
          }

          throw new Error('Invalid request')
        },
      },
    },
  }),
  sdJwtVc: new SdJwtVcModule(),
  askar: new AskarModule(askarModuleConfig),
} as const

const verifierModules = {
  openId4VcVerifier: new OpenId4VcVerifierModule({
    verifierMetadata: {
      verifierBaseUrl: baseUrl,
      verificationEndpointPath: '/verify',
    },
  }),
  sdJwtVc: new SdJwtVcModule(),
  askar: new AskarModule({ ariesAskar }),
} as const

describe('OpenId4Vc', () => {
  let expressApp: Express
  let expressServer: Server

  let issuer: AgentType<typeof issuerModules & { tenants: TenantsModule<typeof issuerModules> }>
  let issuer1: TenantType
  let issuer2: TenantType

  let holder: AgentType<typeof holderModules & { tenants: TenantsModule<typeof holderModules> }>
  let holder1: TenantType

  let verifier: AgentType<typeof verifierModules & { tenants: TenantsModule<typeof verifierModules> }>
  let verifier1: TenantType
  let verifier2: TenantType

  beforeEach(async () => {
    expressApp = express()
    expressApp.use('/oid4vci', oid4vciRouter)

    issuer = await createAgentFromModules(
      'issuer',
      { ...issuerModules, tenants: new TenantsModule<typeof issuerModules>() },
      '96213c3d7fc8d4d6754c7a0fd969598g'
    )
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')
    issuer2 = await createTenantForAgent(issuer.agent, 'iTenant2')

    holder = await createAgentFromModules(
      'holder',
      { ...holderModules, tenants: new TenantsModule() },
      '96213c3d7fc8d4d6754c7a0fd969598e'
    )
    holder1 = await createTenantForAgent(holder.agent, 'hTenant1')

    verifier = await createAgentFromModules(
      'verifier',
      { ...verifierModules, tenants: new TenantsModule() },
      '96213c3d7fc8d4d6754c7a0fd969598f'
    )
    verifier1 = await createTenantForAgent(verifier.agent, 'vTenant1')
    verifier2 = await createTenantForAgent(verifier.agent, 'vTenant2')

    expressServer = expressApp.listen(issuerPort)
  })

  afterEach(async () => {
    expressServer?.close()

    await issuer.agent.shutdown()
    await issuer.agent.wallet.delete()

    await holder.agent.shutdown()
    await holder.agent.wallet.delete()
  })

  const credentialBindingResolver: CredentialBindingResolver = ({ supportsJwk, supportedDidMethods }) => {
    // prefer did:key
    if (supportedDidMethods?.includes('did:key')) {
      return {
        method: 'did',
        didUrl: holder1.verificationMethod.id,
      }
    }

    // otherwise fall back to JWK
    if (supportsJwk) {
      return {
        method: 'jwk',
        jwk: getJwkFromKey(getKeyFromVerificationMethod(holder1.verificationMethod)),
      }
    }

    console.log(supportsJwk, supportedDidMethods)

    // otherwise throw an error
    throw new AriesFrameworkError('Issuer does not support did:key or JWK for credential binding')
  }

  it('e2e flow with tenants, issuer endpoints requesting a sd-jwt-vc', async () => {
    const issuerTenant1 = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const issuerTenant2 = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer2.tenantId })

    const openIdIssuerTenant1 = await issuerTenant1.modules.openId4VcIssuer.createIssuer({
      credentialsSupported: [universityDegreeCredentialSdJwt],
    })

    const openIdIssuerTenant2 = await issuerTenant2.modules.openId4VcIssuer.createIssuer({
      credentialsSupported: [universityDegreeCredentialSdJwt2],
    })

    const { credentialOfferUri: credentialOffer1 } = await issuerTenant1.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: openIdIssuerTenant1.issuerId,
      offeredCredentials: [universityDegreeCredentialSdJwt.id],
      preAuthorizedCodeFlowConfig: { userPinRequired: false },
      ...baseCredentialOfferOptions,
    })

    const { credentialOfferUri: credentialOffer2 } = await issuerTenant2.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: openIdIssuerTenant2.issuerId,
      offeredCredentials: [universityDegreeCredentialSdJwt2.id],
      preAuthorizedCodeFlowConfig: { userPinRequired: false },
      ...baseCredentialOfferOptions,
    })

    await issuerTenant1.endSession()
    await issuerTenant2.endSession()

    const holderTenant1 = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })

    const resolvedCredentialOffer1 = await holderTenant1.modules.openId4VcHolder.resolveCredentialOffer(
      credentialOffer1
    )

    expect(resolvedCredentialOffer1.credentialOfferPayload.credential_issuer).toEqual(
      `${baseUrl}/${openIdIssuerTenant1.issuerId}`
    )
    expect(resolvedCredentialOffer1.metadata.credentialIssuerMetadata?.token_endpoint).toEqual(
      `${baseUrl}/${openIdIssuerTenant1.issuerId}/token`
    )
    expect(resolvedCredentialOffer1.metadata.credentialIssuerMetadata?.credential_endpoint).toEqual(
      `${baseUrl}/${openIdIssuerTenant1.issuerId}/credential`
    )

    // Bind to JWK
    const credentialsTenant1 = await holderTenant1.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
      resolvedCredentialOffer1,
      {
        credentialBindingResolver,
      }
    )

    expect(credentialsTenant1).toHaveLength(1)
    const compactSdJwtVcTenant1 = (credentialsTenant1[0] as SdJwtVc).compact
    const sdJwtVcTenant1 = await holderTenant1.modules.sdJwtVc.fromCompact(compactSdJwtVcTenant1)
    expect(sdJwtVcTenant1.payload.vct).toEqual('UniversityDegreeCredential')

    const resolvedCredentialOffer2 = await holderTenant1.modules.openId4VcHolder.resolveCredentialOffer(
      credentialOffer2
    )
    expect(resolvedCredentialOffer2.credentialOfferPayload.credential_issuer).toEqual(
      `${baseUrl}/${openIdIssuerTenant2.issuerId}`
    )
    expect(resolvedCredentialOffer2.metadata.credentialIssuerMetadata?.token_endpoint).toEqual(
      `${baseUrl}/${openIdIssuerTenant2.issuerId}/token`
    )
    expect(resolvedCredentialOffer2.metadata.credentialIssuerMetadata?.credential_endpoint).toEqual(
      `${baseUrl}/${openIdIssuerTenant2.issuerId}/credential`
    )

    // Bind to did
    const credentialsTenant2 = await holderTenant1.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
      resolvedCredentialOffer2,
      {
        credentialBindingResolver,
      }
    )

    expect(credentialsTenant2).toHaveLength(1)
    const compactSdJwtVcTenant2 = (credentialsTenant2[0] as SdJwtVc).compact
    const sdJwtVcTenant2 = await holderTenant1.modules.sdJwtVc.fromCompact(compactSdJwtVcTenant2)
    expect(sdJwtVcTenant2.payload.vct).toEqual('UniversityDegreeCredential2')

    await holderTenant1.endSession()
  })

  xit('e2e flow with tenants, verifier endpoints verifying a sd-jwt-vc', async () => {
    const mockFunction1 = jest.fn()
    mockFunction1.mockReturnValue({ status: 200 })

    const mockFunction2 = jest.fn()
    mockFunction2.mockReturnValue({ status: 200 })

    const issuerTenant1 = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const holderTenant1 = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1_1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2_1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })
    const verifier1Router = Router()
    const verifier2Router = Router()
    const verifier1BasePath = '/verifier1'
    const verifier2BasePath = '/verifier2'

    const credential1 = new W3cCredential({
      type: ['VerifiableCredential', 'OpenBadgeCredential'],
      issuer: new W3cIssuer({ id: issuer1.did }),
      credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
      issuanceDate: w3cDate(Date.now()),
    })

    const credential2 = new W3cCredential({
      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
      issuer: new W3cIssuer({ id: issuer1.did }),
      credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
      issuanceDate: w3cDate(Date.now()),
    })

    const issuer1W3cCredentialService = issuerTenant1.dependencyManager.resolve(W3cCredentialService)

    const signed1 = await issuer1W3cCredentialService.signCredential(issuerTenant1.context, {
      format: ClaimFormat.JwtVc,
      credential: credential1,
      alg: JwaSignatureAlgorithm.EdDSA,
      verificationMethod: issuer1.verificationMethod.id,
    })

    const signed2 = await issuer1W3cCredentialService.signCredential(issuerTenant1.context, {
      format: ClaimFormat.JwtVc,
      credential: credential2,
      alg: JwaSignatureAlgorithm.EdDSA,
      verificationMethod: issuer1.verificationMethod.id,
    })

    await holderTenant1.w3cCredentials.storeCredential({ credential: signed1 })
    await holderTenant1.w3cCredentials.storeCredential({ credential: signed2 })

    await verifierTenant1_1.modules.openId4VcVerifier.configureRouter(verifier1Router, {
      basePath: '/verifier1',
      verificationEndpointConfig: {
        enabled: true,
        proofResponseHandler: mockFunction1,
      },
    })

    await verifierTenant2_1.modules.openId4VcVerifier.configureRouter(verifier2Router, {
      basePath: '/verifier2',
      verificationEndpointConfig: {
        enabled: true,
        proofResponseHandler: mockFunction2,
      },
    })

    expressApp.use(verifier1BasePath, verifier1Router)
    expressApp.use(verifier2BasePath, verifier2Router)
    expressServer = expressApp.listen(issuerPort)

    const createProofRequestOptions1: CreateProofRequestOptions = {
      verificationMethod: verifier1.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: openBadgePresentationDefinition,
    }

    const createProofRequestOptions2: CreateProofRequestOptions = {
      verificationMethod: verifier2.verificationMethod,
      holderMetadata: staticOpOpenIdConfigEdDSA,
      presentationDefinition: universityDegreePresentationDefinition,
    }

    const { proofRequest: proofRequest1, proofRequestMetadata: proofRequestMetadata1 } =
      await verifierTenant1_1.modules.openId4VcVerifier.createProofRequest(createProofRequestOptions1)

    expect(
      proofRequest1.startsWith(
        `openid://?redirect_uri=http%3A%2F%2Flocalhost%3A1234%2Fverifier1%2Fverify&presentation_definition=%7B%22id%22%3A%22OpenBadgeCredential`
      )
    ).toBeTruthy()

    const { proofRequest: proofRequest2, proofRequestMetadata: proofRequestMetadata2 } =
      await verifierTenant2_1.modules.openId4VcVerifier.createProofRequest(createProofRequestOptions2)

    expect(
      proofRequest2.startsWith(
        `openid://?redirect_uri=http%3A%2F%2Flocalhost%3A1234%2Fverifier2%2Fverify&presentation_definition=%7B%22id%22%3A%22UniversityDegreeCredential`
      )
    ).toBeTruthy()

    await verifierTenant1_1.endSession()
    await verifierTenant2_1.endSession()

    const result1 = await holderTenant1.modules.openId4VcHolder.resolveProofRequest(proofRequest1)
    if (result1.proofType === 'authentication') throw new Error('Expected a proofRequest')

    result1.presentationSubmission.requirements[0]

    if (!result1.presentationSubmission.areRequirementsSatisfied) {
      throw new Error('Requirements are not satisfied.')
    }

    expect(
      result1.presentationSubmission.requirements[0].submissionEntry[0].verifiableCredentials[0].credential.type
    ).toContain('OpenBadgeCredential')

    const result2 = await holderTenant1.modules.openId4VcHolder.resolveProofRequest(proofRequest2)
    if (result2.proofType === 'authentication') throw new Error('Expected a proofRequest')

    result2.presentationSubmission.requirements[0]

    if (!result2.presentationSubmission.areRequirementsSatisfied) {
      throw new Error('Requirements are not satisfied.')
    }

    expect(
      result2.presentationSubmission.requirements[0].submissionEntry[0].verifiableCredentials[0].credential.type
    ).toContain('UniversityDegreeCredential')

    const { status: status1, submittedResponse: submittedResponse1 } =
      await holderTenant1.modules.openId4VcHolder.acceptPresentationRequest(result1.presentationRequest, {
        submission: result1.presentationSubmission,
        submissionEntryIndexes: [0],
      })
    expect(status1).toBe(200)

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant1_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const { idTokenPayload: idTokenPayload1, submission: submission1 } =
      await verifierTenant1_2.modules.openId4VcVerifier.verifyProofResponse(submittedResponse1)

    const { state: state1, challenge: challenge1 } = proofRequestMetadata1
    expect(idTokenPayload1).toBeDefined()
    expect(idTokenPayload1.state).toMatch(state1)
    expect(idTokenPayload1.nonce).toMatch(challenge1)

    expect(submission1).toBeDefined()
    expect(submission1?.presentationDefinitions).toHaveLength(1)
    expect(submission1?.submissionData.definition_id).toBe('OpenBadgeCredential')
    expect(submission1?.presentations).toHaveLength(1)
    expect(submission1?.presentations[0].vcs[0].credential.type).toEqual([
      'VerifiableCredential',
      'OpenBadgeCredential',
    ])

    await waitForMockFunction(mockFunction1)
    expect(mockFunction1).toBeCalledWith({
      idTokenPayload: expect.objectContaining(idTokenPayload1),
      submission: expect.objectContaining(submission1),
    })

    const { status: status2, submittedResponse: submittedResponse2 } =
      await holderTenant1.modules.openId4VcHolder.acceptPresentationRequest(result2.presentationRequest, {
        submission: result2.presentationSubmission,
        submissionEntryIndexes: [0],
      })
    expect(status2).toBe(200)

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant2_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })
    const { idTokenPayload: idTokenPayload2, submission: submission2 } =
      await verifierTenant2_2.modules.openId4VcVerifier.verifyProofResponse(submittedResponse2)

    const { state: state2, challenge: challenge2 } = proofRequestMetadata2
    expect(idTokenPayload2).toBeDefined()
    expect(idTokenPayload2.state).toMatch(state2)
    expect(idTokenPayload2.nonce).toMatch(challenge2)

    expect(submission2).toBeDefined()
    expect(submission2?.presentationDefinitions).toHaveLength(1)
    expect(submission2?.submissionData.definition_id).toBe('UniversityDegreeCredential')
    expect(submission2?.presentations).toHaveLength(1)
    expect(submission2?.presentations[0].vcs[0].credential.type).toEqual([
      'VerifiableCredential',
      'UniversityDegreeCredential',
    ])

    await waitForMockFunction(mockFunction2)
    expect(mockFunction2).toBeCalledWith({
      idTokenPayload: expect.objectContaining(idTokenPayload2),
      submission: expect.objectContaining(submission2),
    })
  })
})
