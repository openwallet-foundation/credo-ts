import {
  ClaimFormat,
  DidsApi,
  DifPresentationExchangeService,
  Kms,
  W3cCredential,
  W3cCredentialSubject,
  W3cIssuer,
  w3cDate,
} from '@credo-ts/core'
import express, { type Express } from 'express'
import type { Server } from 'http'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { TenantsModule } from '../../tenants/src'
import type {
  OpenId4VcIssuerModuleConfigOptions,
  OpenId4VcVerifierModuleConfig,
  OpenId4VcVerifierModuleConfigOptions,
} from '../src'
import { OpenId4VcIssuerModule, OpenId4VcModule, OpenId4VcVerificationSessionState } from '../src'
import type { AgentType, TenantType } from './utils'
import { createAgentFromModules, createTenantForAgent, waitForVerificationSessionRecordSubject } from './utils'
import { openBadgePresentationDefinition, universityDegreePresentationDefinition } from './utilsVp'

const serverPort = 1234
const baseUrl = `http://localhost:${serverPort}`
const issuanceBaseUrl = `${baseUrl}/oid4vci`
const verificationBaseUrl = `${baseUrl}/oid4vp`

describe('OpenId4Vc-federation', () => {
  let expressApp: Express
  let expressServer: Server

  let issuer: AgentType<{
    openid4vc: OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, OpenId4VcVerifierModuleConfigOptions>
    tenants: TenantsModule<{ openId4VcIssuer: OpenId4VcIssuerModule }>
  }>
  // let issuer1: TenantType
  // let issuer2: TenantType

  let holder: AgentType<{
    openid4vc: OpenId4VcModule
    tenants: TenantsModule<{ openid4vc: OpenId4VcModule }>
  }>
  let holder1: TenantType

  let verifier: AgentType<{
    openid4vc: OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, OpenId4VcVerifierModuleConfigOptions>
    tenants: TenantsModule<{
      openid4vc: OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, OpenId4VcVerifierModuleConfigOptions>
    }>
  }>
  let verifier1: TenantType
  let verifier2: TenantType

  let federationConfig: OpenId4VcVerifierModuleConfig['federation'] | undefined

  beforeEach(async () => {
    expressApp = express()

    issuer = (await createAgentFromModules(
      {
        inMemory: new InMemoryWalletModule(),
        tenants: new TenantsModule(),
        openid4vc: new OpenId4VcModule({
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper: async ({
              agentContext,
              credentialRequest,
              holderBinding,
              credentialConfigurationId,
            }) => {
              // We sign the request with the first did:key did we have
              const didsApi = agentContext.dependencyManager.resolve(DidsApi)
              const [firstDidKeyDid] = await didsApi.getCreatedDids({ method: 'key' })
              const didDocument = await didsApi.resolveDidDocument(firstDidKeyDid.did)
              const verificationMethod = didDocument.verificationMethod?.[0]
              if (!verificationMethod) {
                throw new Error('No verification method found')
              }

              if (credentialRequest.format === 'dc+sd-jwt') {
                return {
                  type: 'credentials',
                  credentialConfigurationId,
                  format: credentialRequest.format,
                  credentials: holderBinding.keys.map((holderBinding) => ({
                    payload: { vct: credentialRequest.vct, university: 'innsbruck', degree: 'bachelor' },
                    holder: holderBinding,
                    issuer: {
                      method: 'did',
                      didUrl: verificationMethod.id,
                    },
                    disclosureFrame: { _sd: ['university', 'degree'] },
                  })),
                }
              }
              throw new Error('Invalid request')
            },
          },
        }),
      },
      '96213c3d7fc8d4d6754c7a0fd969598g'
    )) as unknown as typeof issuer

    holder = (await createAgentFromModules(
      {
        openid4vc: new OpenId4VcModule(),
        inMemory: new InMemoryWalletModule(),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598e'
    )) as unknown as typeof holder
    holder1 = await createTenantForAgent(holder.agent, 'hTenant1')

    verifier = (await createAgentFromModules(
      {
        openid4vc: new OpenId4VcModule({
          verifier: {
            baseUrl: verificationBaseUrl,
            federation: {
              async isSubordinateEntity(agentContext, options) {
                if (federationConfig?.isSubordinateEntity) {
                  return federationConfig.isSubordinateEntity(agentContext, options)
                }
                return false
              },
              async getAuthorityHints(agentContext, options) {
                if (federationConfig?.getAuthorityHints) {
                  return federationConfig.getAuthorityHints(agentContext, options)
                }
                return undefined
              },
            },
          },
        }),
        inMemory: new InMemoryWalletModule(),
        tenants: new TenantsModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598f'
    )) as unknown as typeof verifier
    verifier1 = await createTenantForAgent(verifier.agent, 'vTenant1')
    verifier2 = await createTenantForAgent(verifier.agent, 'vTenant2')

    // We let AFJ create the router, so we have a fresh one each time
    expressApp.use('/oid4vci', issuer.agent.openid4vc.issuer.config.router)
    expressApp.use('/oid4vp', verifier.agent.openid4vc.verifier.config.router)

    expressServer = expressApp.listen(serverPort)
  })

  afterEach(async () => {
    expressServer?.close()

    await issuer.agent.shutdown()
    await holder.agent.shutdown()
    await verifier.agent.shutdown()

    federationConfig = undefined
  })

  it('e2e flow with tenants and federation, verifier endpoints verifying a jwt-vc', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.openid4vc.verifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.openid4vc.verifier.createVerifier()

    const signedCredential1 = await issuer.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cIssuer({ id: issuer.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
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
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: issuer.verificationMethod.id,
    })

    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential1 })
    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential2 })

    const { authorizationRequest: authorizationRequestUri1, verificationSession: verificationSession1 } =
      await verifierTenant1.openid4vc.verifier
        .createAuthorizationRequest({
          verifierId: openIdVerifierTenant1.verifierId,
          requestSigner: {
            method: 'federation',
          },
          presentationExchange: {
            definition: openBadgePresentationDefinition,
          },
          version: 'v1.draft24',
        })
        .catch((error) => {
          throw error
        })

    expect(authorizationRequestUri1).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(
        `http://localhost:1234/oid4vp/${openIdVerifierTenant1.verifierId}`
      )}&request_uri=${encodeURIComponent(verificationSession1.authorizationRequestUri as string)}`
    )

    const { authorizationRequest: authorizationRequestUri2, verificationSession: verificationSession2 } =
      await verifierTenant2.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: {
          method: 'federation',
        },
        presentationExchange: {
          definition: universityDegreePresentationDefinition,
        },
        verifierId: openIdVerifierTenant2.verifierId,
        version: 'v1.draft24',
      })

    expect(authorizationRequestUri2).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(
        `http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`
      )}&request_uri=${encodeURIComponent(verificationSession2.authorizationRequestUri as string)}`
    )

    await verifierTenant1.endSession()
    await verifierTenant2.endSession()

    const resolvedProofRequest1 = await holderTenant.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequestUri1,
      {
        trustedFederationEntityIds: [`http://localhost:1234/oid4vp/${openIdVerifierTenant1.verifierId}`],
      }
    )

    expect(resolvedProofRequest1.presentationExchange?.credentialsForRequest).toMatchObject({
      areRequirementsSatisfied: true,
      requirements: [
        {
          submissionEntry: [
            {
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.JwtVc,
                  credentialRecord: {
                    credential: {
                      type: ['VerifiableCredential', 'OpenBadgeCredential'],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    const resolvedProofRequest2 = await holderTenant.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequestUri2,
      {
        trustedFederationEntityIds: [`http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`],
      }
    )

    expect(resolvedProofRequest2.presentationExchange?.credentialsForRequest).toMatchObject({
      areRequirementsSatisfied: true,
      requirements: [
        {
          submissionEntry: [
            {
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.JwtVc,
                  credentialRecord: {
                    credential: {
                      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    if (!resolvedProofRequest1.presentationExchange || !resolvedProofRequest2.presentationExchange) {
      throw new Error('Presentation exchange not defined')
    }

    const presentationExchangeService = holderTenant.dependencyManager.resolve(DifPresentationExchangeService)
    const selectedCredentials = presentationExchangeService.selectCredentialsForRequest(
      resolvedProofRequest1.presentationExchange.credentialsForRequest
    )

    const { authorizationResponsePayload: submittedResponse1, serverResponse: serverResponse1 } =
      await holderTenant.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedProofRequest1.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials,
        },
      })

    expect(submittedResponse1).toEqual({
      presentation_submission: {
        definition_id: 'OpenBadgeCredential',
        descriptor_map: [
          {
            format: 'jwt_vp',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$',
            path_nested: {
              format: 'jwt_vc',
              id: 'OpenBadgeCredentialDescriptor',
              path: '$.vp.verifiableCredential[0]',
            },
          },
        ],
        id: expect.any(String),
      },
      state: expect.any(String),
      vp_token: expect.any(String),
    })
    expect(serverResponse1).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant1_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifierTenant1_2.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession1.id,
    })

    const { presentationExchange: presentationExchange1 } =
      await verifierTenant1_2.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession1.id)

    expect(presentationExchange1).toMatchObject({
      definition: openBadgePresentationDefinition,
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
      resolvedProofRequest2.presentationExchange.credentialsForRequest
    )

    const { serverResponse: serverResponse2 } = await holderTenant.openid4vc.holder.acceptOpenId4VpAuthorizationRequest(
      {
        authorizationRequestPayload: resolvedProofRequest2.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials2,
        },
      }
    )
    expect(serverResponse2).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant2_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifierTenant2_2.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession2.id,
    })
    const { presentationExchange: presentationExchange2 } =
      await verifierTenant2_2.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession2.id)

    expect(presentationExchange2).toMatchObject({
      definition: universityDegreePresentationDefinition,
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

  it('e2e flow with tenants and federation with multiple layers, verifier endpoints verifying a jwt-vc', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.openid4vc.verifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.openid4vc.verifier.createVerifier()

    const signedCredential1 = await issuer.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cIssuer({ id: issuer.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
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
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: issuer.verificationMethod.id,
    })

    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential1 })
    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential2 })

    const { authorizationRequest: authorizationRequestUri1, verificationSession: verificationSession1 } =
      await verifierTenant1.openid4vc.verifier.createAuthorizationRequest({
        verifierId: openIdVerifierTenant1.verifierId,
        requestSigner: {
          method: 'federation',
        },
        presentationExchange: {
          definition: openBadgePresentationDefinition,
        },
        version: 'v1.draft24',
      })

    expect(authorizationRequestUri1).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(
        `http://localhost:1234/oid4vp/${openIdVerifierTenant1.verifierId}`
      )}&request_uri=${encodeURIComponent(verificationSession1.authorizationRequestUri as string)}`
    )

    const { authorizationRequest: authorizationRequestUri2, verificationSession: verificationSession2 } =
      await verifierTenant2.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: {
          method: 'federation',
        },
        presentationExchange: {
          definition: universityDegreePresentationDefinition,
        },
        verifierId: openIdVerifierTenant2.verifierId,
        version: 'v1.draft24',
      })

    expect(authorizationRequestUri2).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(
        `http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`
      )}&request_uri=${encodeURIComponent(verificationSession2.authorizationRequestUri as string)}`
    )

    await verifierTenant1.endSession()
    await verifierTenant2.endSession()

    federationConfig = {
      isSubordinateEntity: async (_agentContext, options) => {
        // When the verifier 2 gets asked if verifier 1 is a subordinate entity, it should return true
        return options.verifierId === openIdVerifierTenant2.verifierId
      },
      getAuthorityHints: async (_agentContext, options) => {
        // The verifier 1 says that the verifier 2 is above him
        return options.verifierId === openIdVerifierTenant1.verifierId
          ? [`http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`]
          : undefined
      },
    }

    // Gets a request from verifier 1 but we trust verifier 2 so if the verifier 1 is in the subordinate entity list of verifier 2 it should succeed
    const resolvedProofRequest1 = await holderTenant.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequestUri1,
      {
        trustedFederationEntityIds: [`http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`],
      }
    )

    expect(resolvedProofRequest1.presentationExchange?.credentialsForRequest).toMatchObject({
      areRequirementsSatisfied: true,
      requirements: [
        {
          submissionEntry: [
            {
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.JwtVc,
                  credentialRecord: {
                    credential: {
                      type: ['VerifiableCredential', 'OpenBadgeCredential'],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    const resolvedProofRequest2 = await holderTenant.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      authorizationRequestUri2,
      {
        trustedFederationEntityIds: [`http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`],
      }
    )

    expect(resolvedProofRequest2.presentationExchange?.credentialsForRequest).toMatchObject({
      areRequirementsSatisfied: true,
      requirements: [
        {
          submissionEntry: [
            {
              verifiableCredentials: [
                {
                  claimFormat: ClaimFormat.JwtVc,
                  credentialRecord: {
                    credential: {
                      type: ['VerifiableCredential', 'UniversityDegreeCredential'],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    })

    if (!resolvedProofRequest1.presentationExchange || !resolvedProofRequest2.presentationExchange) {
      throw new Error('Presentation exchange not defined')
    }

    const presentationExchangeService = holderTenant.dependencyManager.resolve(DifPresentationExchangeService)
    const selectedCredentials = presentationExchangeService.selectCredentialsForRequest(
      resolvedProofRequest1.presentationExchange.credentialsForRequest
    )

    const { authorizationResponsePayload: submittedResponse1, serverResponse: serverResponse1 } =
      await holderTenant.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
        authorizationRequestPayload: resolvedProofRequest1.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials,
        },
      })

    expect(submittedResponse1).toEqual({
      presentation_submission: {
        definition_id: 'OpenBadgeCredential',
        descriptor_map: [
          {
            format: 'jwt_vp',
            id: 'OpenBadgeCredentialDescriptor',
            path: '$',
            path_nested: {
              format: 'jwt_vc',
              id: 'OpenBadgeCredentialDescriptor',
              path: '$.vp.verifiableCredential[0]',
            },
          },
        ],
        id: expect.any(String),
      },
      state: expect.any(String),
      vp_token: expect.any(String),
    })
    expect(serverResponse1).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant1_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifierTenant1_2.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession1.id,
    })

    const { presentationExchange: presentationExchange1 } =
      await verifierTenant1_2.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession1.id)

    expect(presentationExchange1).toMatchObject({
      definition: openBadgePresentationDefinition,
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
      resolvedProofRequest2.presentationExchange.credentialsForRequest
    )

    const { serverResponse: serverResponse2 } = await holderTenant.openid4vc.holder.acceptOpenId4VpAuthorizationRequest(
      {
        authorizationRequestPayload: resolvedProofRequest2.authorizationRequestPayload,
        presentationExchange: {
          credentials: selectedCredentials2,
        },
      }
    )
    expect(serverResponse2).toMatchObject({
      status: 200,
    })

    // The RP MUST validate that the aud (audience) Claim contains the value of the client_id
    // that the RP sent in the Authorization Request as an audience.
    // When the request has been signed, the value might be an HTTPS URL, or a Decentralized Identifier.
    const verifierTenant2_2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })
    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifierTenant2_2.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession2.id,
    })
    const { presentationExchange: presentationExchange2 } =
      await verifierTenant2_2.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession2.id)

    expect(presentationExchange2).toMatchObject({
      definition: universityDegreePresentationDefinition,
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

  it('e2e flow with tenants and federation, unhappy flow', async () => {
    const holderTenant = await holder.agent.modules.tenants.getTenantAgent({ tenantId: holder1.tenantId })
    const verifierTenant1 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier1.tenantId })
    const verifierTenant2 = await verifier.agent.modules.tenants.getTenantAgent({ tenantId: verifier2.tenantId })

    const openIdVerifierTenant1 = await verifierTenant1.openid4vc.verifier.createVerifier()
    const openIdVerifierTenant2 = await verifierTenant2.openid4vc.verifier.createVerifier()

    const signedCredential1 = await issuer.agent.w3cCredentials.signCredential({
      format: ClaimFormat.JwtVc,
      credential: new W3cCredential({
        type: ['VerifiableCredential', 'OpenBadgeCredential'],
        issuer: new W3cIssuer({ id: issuer.did }),
        credentialSubject: new W3cCredentialSubject({ id: holder1.did }),
        issuanceDate: w3cDate(Date.now()),
      }),
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
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
      alg: Kms.KnownJwaSignatureAlgorithms.EdDSA,
      verificationMethod: issuer.verificationMethod.id,
    })

    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential1 })
    await holderTenant.w3cCredentials.storeCredential({ credential: signedCredential2 })

    const { authorizationRequest: authorizationRequestUri1, verificationSession: verificationSession1 } =
      await verifierTenant1.openid4vc.verifier.createAuthorizationRequest({
        verifierId: openIdVerifierTenant1.verifierId,
        requestSigner: {
          method: 'federation',
        },
        presentationExchange: {
          definition: openBadgePresentationDefinition,
        },
        version: 'v1.draft24',
      })

    expect(authorizationRequestUri1).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(
        `http://localhost:1234/oid4vp/${openIdVerifierTenant1.verifierId}`
      )}&request_uri=${encodeURIComponent(verificationSession1.authorizationRequestUri as string)}`
    )

    const { authorizationRequest: authorizationRequestUri2, verificationSession: verificationSession2 } =
      await verifierTenant2.openid4vc.verifier.createAuthorizationRequest({
        requestSigner: {
          method: 'federation',
        },
        presentationExchange: {
          definition: universityDegreePresentationDefinition,
        },
        verifierId: openIdVerifierTenant2.verifierId,
        version: 'v1.draft24',
      })

    expect(authorizationRequestUri2).toEqual(
      `openid4vp://?client_id=${encodeURIComponent(
        `http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`
      )}&request_uri=${encodeURIComponent(verificationSession2.authorizationRequestUri as string)}`
    )

    await verifierTenant1.endSession()
    await verifierTenant2.endSession()

    const resolvedProofRequestWithFederationPromise =
      holderTenant.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequestUri1, {
        // This will look for a whole different trusted entity
        trustedFederationEntityIds: [`http://localhost:1234/oid4vp/${openIdVerifierTenant2.verifierId}`],
      })

    // TODO: Look into this error see if we can make it more specific
    await expect(resolvedProofRequestWithFederationPromise).rejects.toThrow('Error during verification of jwt.')

    const resolvedProofRequestWithoutFederationPromise =
      holderTenant.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequestUri2)
    await expect(resolvedProofRequestWithoutFederationPromise).rejects.toThrow('Error during verification of jwt.')
  })
})
