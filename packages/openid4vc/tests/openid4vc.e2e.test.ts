import type { AgentType, TenantType } from './utils'
import type { CredentialBindingResolver } from '../src/openid4vc-holder'
import type { SdJwtVc, SdJwtVcSignOptions } from '@aries-framework/sd-jwt-vc'
import type { Server } from 'http'

import { AskarModule } from '@aries-framework/askar'
import {
  ClaimFormat,
  JwaSignatureAlgorithm,
  W3cCredential,
  W3cCredentialSubject,
  W3cIssuer,
  w3cDate,
  DidsApi,
  getKeyFromVerificationMethod,
  getJwkFromKey,
  AriesFrameworkError,
  DifPresentationExchangeService,
} from '@aries-framework/core'
import { SdJwtVcModule } from '@aries-framework/sd-jwt-vc'
import { TenantsModule } from '@aries-framework/tenants'
import { ariesAskar } from '@hyperledger/aries-askar-nodejs'
import express, { type Express } from 'express'

import { askarModuleConfig } from '../../askar/tests/helpers'
import { OpenId4VcVerifierModule, OpenId4VcHolderModule, OpenId4VcIssuerModule } from '../src'

import { createAgentFromModules, createTenantForAgent } from './utils'
import { universityDegreeCredentialSdJwt, universityDegreeCredentialSdJwt2 } from './utilsVci'
import {
  openBadgePresentationDefinition,
  staticOpOpenIdConfigEdDSA,
  universityDegreePresentationDefinition,
} from './utilsVp'

const serverPort = 1234
const baseUrl = `http://localhost:${serverPort}`
const issuanceBaseUrl = `${baseUrl}/oid4vci`
const verificationBaseUrl = `${baseUrl}/oid4vp`

const baseCredentialOfferOptions = {
  scheme: 'openid-credential-offer',
  baseUri: issuanceBaseUrl,
}

describe('OpenId4Vc', () => {
  let expressApp: Express
  let expressServer: Server

  let issuer: AgentType<{
    openId4VcIssuer: OpenId4VcIssuerModule
    tenants: TenantsModule<{ openId4VcIssuer: OpenId4VcIssuerModule }>
  }>
  let issuer1: TenantType
  let issuer2: TenantType

  let holder: AgentType<{
    openId4VcHolder: OpenId4VcHolderModule
    sdJwtVc: SdJwtVcModule
    tenants: TenantsModule<{ openId4VcHolder: OpenId4VcHolderModule; sdJwtVc: SdJwtVcModule }>
  }>
  let holder1: TenantType

  let verifier: AgentType<{
    openId4VcVerifier: OpenId4VcVerifierModule
    tenants: TenantsModule<{ openId4VcVerifier: OpenId4VcVerifierModule }>
  }>
  let verifier1: TenantType
  let verifier2: TenantType

  beforeEach(async () => {
    expressApp = express()

    issuer = (await createAgentFromModules(
      'issuer',
      {
        openId4VcIssuer: new OpenId4VcIssuerModule({
          baseUrl: issuanceBaseUrl,
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
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g'
    )) as unknown as typeof issuer
    issuer1 = await createTenantForAgent(issuer.agent, 'iTenant1')
    issuer2 = await createTenantForAgent(issuer.agent, 'iTenant2')

    holder = (await createAgentFromModules(
      'holder',
      {
        openId4VcHolder: new OpenId4VcHolderModule(),
        sdJwtVc: new SdJwtVcModule(),
        askar: new AskarModule(askarModuleConfig),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598e'
    )) as unknown as typeof holder
    holder1 = await createTenantForAgent(holder.agent, 'hTenant1')

    verifier = (await createAgentFromModules(
      'verifier',
      {
        openId4VcVerifier: new OpenId4VcVerifierModule({
          baseUrl: verificationBaseUrl,
        }),
        sdJwtVc: new SdJwtVcModule(),
        askar: new AskarModule({ ariesAskar }),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598f'
    )) as unknown as typeof verifier
    verifier1 = await createTenantForAgent(verifier.agent, 'vTenant1')
    verifier2 = await createTenantForAgent(verifier.agent, 'vTenant2')

    // We let AFJ create the router, so we have a fresh one each time
    expressApp.use('/oid4vci', issuer.agent.modules.openId4VcIssuer.config.router)
    expressApp.use('/oid4vp', verifier.agent.modules.openId4VcVerifier.config.router)

    expressServer = expressApp.listen(serverPort)
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
      `${issuanceBaseUrl}/${openIdIssuerTenant1.issuerId}`
    )
    expect(resolvedCredentialOffer1.metadata.credentialIssuerMetadata?.token_endpoint).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant1.issuerId}/token`
    )
    expect(resolvedCredentialOffer1.metadata.credentialIssuerMetadata?.credential_endpoint).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant1.issuerId}/credential`
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
      `${issuanceBaseUrl}/${openIdIssuerTenant2.issuerId}`
    )
    expect(resolvedCredentialOffer2.metadata.credentialIssuerMetadata?.token_endpoint).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant2.issuerId}/token`
    )
    expect(resolvedCredentialOffer2.metadata.credentialIssuerMetadata?.credential_endpoint).toEqual(
      `${issuanceBaseUrl}/${openIdIssuerTenant2.issuerId}/credential`
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

  it('e2e flow with tenants, verifier endpoints verifying a sd-jwt-vc', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.modules.openId4VcVerifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.modules.openId4VcVerifier.createVerifier()

    const signedCredential1 = await issuer.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cIssuer({ id: issuer.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: JwaSignatureAlgorithm.EdDSA,
      verificationMethod: issuer.verificationMethod.id,
    })

    const signedCredential2 = await issuer.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'UniversityDegreeCredential'],
        issuer: new W3cIssuer({ id: issuer.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: JwaSignatureAlgorithm.EdDSA,
      verificationMethod: issuer.verificationMethod.id,
    })

    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential1 })
    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential2 })

    const { authorizationRequestUri: authorizationRequestUri1, metadata: proofRequestMetadata1 } =
      await verifierTenant1.modules.openId4VcVerifier.createAuthorizationRequest({
        verificationMethod: verifier1.verificationMethod,
        openIdProvider: staticOpOpenIdConfigEdDSA,
        presentationDefinition: openBadgePresentationDefinition,
        verifierId: openIdVerifierTenant1.verifierId,
      })

    // FIXME: the presentation definition is in both top-level and request param?
    expect(
      authorizationRequestUri1.startsWith(
        `openid://?redirect_uri=http%3A%2F%2Flocalhost%3A1234%2Foid4vp%2F${openIdVerifierTenant1.verifierId}%2Fauthorize&presentation_definition=%7B%22id%22%3A%22OpenBadgeCredential`
      )
    ).toBe(true)

    const { authorizationRequestUri: authorizationRequestUri2, metadata: proofRequestMetadata2 } =
      await verifierTenant2.modules.openId4VcVerifier.createAuthorizationRequest({
        verificationMethod: verifier2.verificationMethod,
        openIdProvider: staticOpOpenIdConfigEdDSA,
        presentationDefinition: universityDegreePresentationDefinition,
        verifierId: openIdVerifierTenant2.verifierId,
      })

    // FIXME: we should set scheme based on the openid provider metadata
    // Is the op set in the request?
    // FIXME: did:peer should not be supported
    expect(
      authorizationRequestUri2.startsWith(
        `openid://?redirect_uri=http%3A%2F%2Flocalhost%3A1234%2Foid4vp%2F${openIdVerifierTenant2.verifierId}%2Fauthorize&presentation_definition=%7B%22id%22%3A%22UniversityDegreeCredential`
      )
    ).toBe(true)

    await verifierTenant1.endSession()
    await verifierTenant2.endSession()

    // FIXME: api already has resolve authorization request
    // but it's used for oid4vci. We should have some improvements on the api
    const resolvedProofRequest1 = await holderTenant.modules.openId4VcHolder.resolveProofRequest(
      authorizationRequestUri1
    )
    if (resolvedProofRequest1.proofType === 'authentication') throw new Error('Expected a proofRequest')

    if (!resolvedProofRequest1.credentialsForRequest.areRequirementsSatisfied) {
      throw new Error('Requirements are not satisfied.')
    }

    expect(
      resolvedProofRequest1.credentialsForRequest.requirements[0].submissionEntry[0].verifiableCredentials[0].credential
        .type
    ).toContain('OpenBadgeCredential')

    const resolvedProofRequest2 = await holderTenant.modules.openId4VcHolder.resolveProofRequest(
      authorizationRequestUri2
    )
    if (resolvedProofRequest2.proofType === 'authentication') throw new Error('Expected a proofRequest')

    if (!resolvedProofRequest2.credentialsForRequest.areRequirementsSatisfied) {
      throw new Error('Requirements are not satisfied.')
    }

    // FIXME: result MUST include SD-JWT as well
    expect(
      resolvedProofRequest2.credentialsForRequest.requirements[0].submissionEntry[0].verifiableCredentials[0].credential
        .type
    ).toContain('UniversityDegreeCredential')

    const presentationExchangeService = holderTenant.dependencyManager.resolve(DifPresentationExchangeService)
    const selectedCredentials = presentationExchangeService.selectCredentialsForRequest(
      resolvedProofRequest1.credentialsForRequest
    )

    const { status: status1, submittedResponse: submittedResponse1 } =
      await holderTenant.modules.openId4VcHolder.acceptPresentationRequest(
        resolvedProofRequest1.presentationRequest,
        selectedCredentials
      )
    expect(submittedResponse1).toEqual({
      expires_in: 6000,
      id_token: expect.any(String),
      presentation_submission: {
        definition_id: 'OpenBadgeCredential',
        descriptor_map: [
          {
            format: 'jwt_vc',
            id: 'OpenBadgeCredential',
            path: '$.verifiableCredential[0]',
          },
        ],
        id: expect.any(String),
      },
      state: expect.any(String),
      vp_token: expect.any(String),
    })
    expect(status1).toBe(200)

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant1_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const { idTokenPayload: idTokenPayload1, presentationExchange: presentationExchange1 } =
      await verifierTenant1_2.modules.openId4VcVerifier.verifyAuthorizationResponse({
        authorizationResponse: submittedResponse1,
        verifierId: openIdVerifierTenant1.verifierId,
      })

    const { state: state1, nonce: nonce1 } = proofRequestMetadata1
    expect(idTokenPayload1).toMatchObject({
      state: state1,
      nonce: nonce1,
    })

    expect(presentationExchange1).toMatchObject({
      definitions: [openBadgePresentationDefinition],
      submission: {
        definition_id: 'OpenBadgeCredential',
      },
      presentations: [
        {
          verifiableCredential: [
            {
              type: ['VerifiableCredential', 'OpenBadgeCredential'],
            },
          ],
        },
      ],
    })

    const selectedCredentials2 = presentationExchangeService.selectCredentialsForRequest(
      resolvedProofRequest2.credentialsForRequest
    )

    // FIXME: do we want to return the submitted response? And the status code?
    // Also, do we get anything back for submitting this?
    const { status: status2, submittedResponse: submittedResponse2 } =
      await holderTenant.modules.openId4VcHolder.acceptPresentationRequest(
        resolvedProofRequest2.presentationRequest,
        selectedCredentials2
      )
    expect(status2).toBe(200)

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant2_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })
    const { idTokenPayload: idTokenPayload2, presentationExchange: presentationExchange2 } =
      await verifierTenant2_2.modules.openId4VcVerifier.verifyAuthorizationResponse({
        authorizationResponse: submittedResponse2,
        verifierId: openIdVerifierTenant2.verifierId,
      })

    expect(idTokenPayload2).toMatchObject({
      state: proofRequestMetadata2.state,
      nonce: proofRequestMetadata2.nonce,
    })

    expect(presentationExchange2).toMatchObject({
      definitions: [universityDegreePresentationDefinition],
      submission: {
        definition_id: 'UniversityDegreeCredential',
      },
      presentations: [
        {
          verifiableCredential: [
            {
              type: ['VerifiableCredential', 'UniversityDegreeCredential'],
            },
          ],
        },
      ],
    })
  })
})
