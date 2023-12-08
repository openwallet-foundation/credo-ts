import type { IssuerMetadata } from './../src/openid4vc-issuer'
import type { AgentType, TenantType } from './utils'
import type { CreateProofRequestOptions } from '../src'
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
} from '@aries-framework/core'
import { SdJwtVcModule } from '@aries-framework/sd-jwt-vc'
import { TenantsModule } from '@aries-framework/tenants'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import express, { Router, type Express } from 'express'

import { SdJwtCredential } from '../../sd-jwt-vc/src/SdJwtCredential'
import { OpenId4VcVerifierModule } from '../src'
import { OpenId4VcHolderModule } from '../src/openid4vc-holder'
import { OpenId4VcIssuerModule } from '../src/openid4vc-issuer'

import { createAgentFromModules, createTenantForAgent } from './utils'
import { allCredentialsSupported, universityDegreeCredentialSdJwt, universityDegreeCredentialSdJwt2 } from './utilsVci'
import {
  openBadgePresentationDefinition,
  staticOpOpenIdConfigEdDSA,
  universityDegreePresentationDefinition,
  waitForMockFunction,
} from './utilsVp'

const issuerPort = 1234
const baseUrl = `http://localhost:${issuerPort}`

const baseCredentialRequestOptions = {
  scheme: 'openid-credential-offer',
  baseUri: baseUrl,
}

const issuerMetadata: IssuerMetadata = {
  issuerBaseUrl: baseUrl,
  credentialEndpointPath: `/credentials`,
  tokenEndpointPath: `/token`,
  credentialsSupported: allCredentialsSupported,
}
const holderModules = {
  openId4VcHolder: new OpenId4VcHolderModule(),
  sdJwtVc: new SdJwtVcModule(),
  askar: new AskarModule({ ariesAskar }),
} as const

const issuerModules = {
  openId4VcIssuer: new OpenId4VcIssuerModule({ issuerMetadata }),
  sdJwtVc: new SdJwtVcModule(),
  askar: new AskarModule({ ariesAskar }),
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let expressServer: Server<any, any>

  let issuer: AgentType<typeof issuerModules & { tenants: TenantsModule<typeof issuerModules> }>
  let issuer1: TenantType<typeof issuerModules>
  let issuer2: TenantType<typeof issuerModules>

  let holder: AgentType<typeof holderModules & { tenants: TenantsModule<typeof holderModules> }>
  let holder1: TenantType<typeof holderModules>

  let verifier: AgentType<typeof verifierModules & { tenants: TenantsModule<typeof verifierModules> }>
  let verifier1: TenantType<typeof verifierModules>
  let verifier2: TenantType<typeof verifierModules>

  beforeEach(async () => {
    expressApp = express()

    issuer = await createAgentFromModules(
      'issuer',
      { ...issuerModules, tenants: new TenantsModule() },
      '96213c3d7fc8d4d6754c7a0fd969598g'
    )
    issuer1 = await createTenantForAgent(issuer.agent as any, 'iTenant1')
    issuer2 = await createTenantForAgent(issuer.agent as any, 'iTenant2')

    holder = await createAgentFromModules(
      'holder',
      { ...holderModules, tenants: new TenantsModule() },
      '96213c3d7fc8d4d6754c7a0fd969598e'
    )
    holder1 = await createTenantForAgent(holder.agent as any, 'hTenant1')

    verifier = await createAgentFromModules(
      'verifier',
      { ...verifierModules, tenants: new TenantsModule() },
      '96213c3d7fc8d4d6754c7a0fd969598f'
    )
    verifier1 = await createTenantForAgent(verifier.agent as any, 'vTenant1')
    verifier2 = await createTenantForAgent(verifier.agent as any, 'vTenant2')
  })

  afterEach(async () => {
    expressServer?.close()

    await issuer.agent.shutdown()
    await issuer.agent.wallet.delete()

    await holder.agent.shutdown()
    await holder.agent.wallet.delete()
  })

  it('e2e flow with tenants, issuer endpoints requesting a sdjwtvc', async () => {
    const issuerTenant1 = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer1.tenantId })
    const issuer1Router = Router()
    const issuer1BasePath = '/issuer1'

    await issuerTenant1.modules.openId4VcIssuer.configureRouter(issuer1Router, {
      basePath: issuer1BasePath,
      metadataEndpointConfig: { enabled: true },
      accessTokenEndpointConfig: {
        enabled: true,
        preAuthorizedCodeExpirationDuration: 50,
        verificationMethod: issuer1.verificationMethod,
      },
      credentialEndpointConfig: {
        enabled: true,
        verificationMethod: issuer1.verificationMethod,
        credentialRequestToCredentialMapper: async ({ credentialRequest, holderDid, holderDidUrl }) => {
          if (
            credentialRequest.format === 'vc+sd-jwt' &&
            credentialRequest.credential_definition.vct === 'UniversityDegreeCredential'
          ) {
            if (holderDid !== holder1.did) throw new Error('Invalid holder did')

            return new SdJwtCredential({
              payload: { type: 'UniversityDegreeCredential', university: 'innsbruck', degree: 'bachelor' },
              holderDidUrl: holderDidUrl,
              issuerDidUrl: issuer1.kid,
              disclosureFrame: { university: true, degree: true },
            })
          }

          throw new Error('Invalid request')
        },
      },
    })

    const issuerTenant2 = await issuer.agent.modules.tenants.getTenantAgent({ tenantId: issuer2.tenantId })
    const issuer2Router = Router()
    const issuer2BasePath = '/issuer2'

    await issuerTenant2.modules.openId4VcIssuer.configureRouter(issuer2Router, {
      basePath: issuer2BasePath,
      metadataEndpointConfig: { enabled: true },
      accessTokenEndpointConfig: {
        enabled: true,
        preAuthorizedCodeExpirationDuration: 50,
        verificationMethod: issuer2.verificationMethod,
      },
      credentialEndpointConfig: {
        enabled: true,
        verificationMethod: issuer2.verificationMethod,
        credentialRequestToCredentialMapper: async ({ credentialRequest, holderDid, holderDidUrl }) => {
          if (
            credentialRequest.format === 'vc+sd-jwt' &&
            credentialRequest.credential_definition.vct === 'UniversityDegreeCredential2'
          ) {
            if (holderDid !== holder1.did) throw new Error('Invalid holder did')

            return new SdJwtCredential({
              payload: { type: 'UniversityDegreeCredential2', university: 'innsbruck', degree: 'bachelor' },
              holderDidUrl: holderDidUrl,
              issuerDidUrl: issuer2.kid,
              disclosureFrame: { university: true, degree: true },
            })
          }

          throw new Error('Invalid request')
        },
      },
    })

    expressApp.use(issuer1BasePath, issuer1Router)
    expressApp.use(issuer2BasePath, issuer2Router)
    expressServer = expressApp.listen(issuerPort)

    const { credentialOfferRequest: credentialOfferRequest1 } =
      await issuerTenant1.modules.openId4VcIssuer.createCredentialOfferAndRequest(
        [universityDegreeCredentialSdJwt.id],
        { preAuthorizedCodeFlowConfig: { userPinRequired: false }, ...baseCredentialRequestOptions }
      )

    const { credentialOfferRequest: credentialOfferRequest2 } =
      await issuerTenant2.modules.openId4VcIssuer.createCredentialOfferAndRequest(
        [universityDegreeCredentialSdJwt2.id],
        { preAuthorizedCodeFlowConfig: { userPinRequired: false }, ...baseCredentialRequestOptions }
      )

    await issuerTenant1.endSession()
    await issuerTenant2.endSession()

    const holderTenant1 = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })

    const resolvedCredentialOffer1 = await holderTenant1.modules.openId4VcHolder.resolveCredentialOffer(
      credentialOfferRequest1
    )

    expect(resolvedCredentialOffer1.credentialOfferPayload.credential_issuer).toEqual(`${baseUrl}/issuer1`)
    expect(resolvedCredentialOffer1.metadata.credentialIssuerMetadata?.token_endpoint).toEqual(
      `${baseUrl}/issuer1/token`
    )
    expect(resolvedCredentialOffer1.metadata.credentialIssuerMetadata?.credential_endpoint).toEqual(
      `${baseUrl}/issuer1/credentials`
    )

    const credentials1 = await holderTenant1.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
      resolvedCredentialOffer1,
      {
        proofOfPossessionVerificationMethodResolver: async () => {
          return holder1.verificationMethod
        },
      }
    )

    const resolvedCredentialOffer2 = await holderTenant1.modules.openId4VcHolder.resolveCredentialOffer(
      credentialOfferRequest2
    )
    expect(resolvedCredentialOffer2.credentialOfferPayload.credential_issuer).toEqual(`${baseUrl}/issuer2`)
    expect(resolvedCredentialOffer2.metadata.credentialIssuerMetadata?.token_endpoint).toEqual(
      `${baseUrl}/issuer2/token`
    )
    expect(resolvedCredentialOffer2.metadata.credentialIssuerMetadata?.credential_endpoint).toEqual(
      `${baseUrl}/issuer2/credentials`
    )

    expect(credentials1).toHaveLength(1)
    if (credentials1[0].type === 'W3cCredentialRecord') throw new Error('Invalid credential type')
    expect(credentials1[0].sdJwtVc.payload['type']).toEqual('UniversityDegreeCredential')

    const credentials2 = await holderTenant1.modules.openId4VcHolder.acceptCredentialOfferUsingPreAuthorizedCode(
      resolvedCredentialOffer2,
      {
        proofOfPossessionVerificationMethodResolver: async () => {
          return holder1.verificationMethod
        },
      }
    )

    expect(credentials2).toHaveLength(1)
    if (credentials2[0].type === 'W3cCredentialRecord') throw new Error('Invalid credential type')
    expect(credentials2[0].sdJwtVc.payload['type']).toEqual('UniversityDegreeCredential2')

    await holderTenant1.endSession()
  })

  it('e2e flow with tenants, verifier endpoints verifying a sdjwtvc', async () => {
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
