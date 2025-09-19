import type { AgentType } from './utils'

import { ClaimFormat, CredoError, Kms } from '@credo-ts/core'
import express, { type Express } from 'express'

import { setupNockToExpress } from '../../../tests/nockToExpress'
import {
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuerModuleConfigOptions,
  OpenId4VcIssuerRecord,
  OpenId4VcModule,
  OpenId4VcVerifierModuleConfigOptions,
  OpenId4VciCredentialConfigurationSupportedWithFormats,
  OpenId4VciCredentialFormatProfile,
} from '../src'

import { Jwk } from '@openid4vc/oauth2'
import { AuthorizationFlow, Openid4vciWalletProvider } from '@openid4vc/openid4vci'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { getOid4vcCallbacks } from '../src/shared/callbacks'
import { addSecondsToDate } from '../src/shared/utils'
import { createAgentFromModules, waitForCredentialIssuanceSessionRecordSubject } from './utils'

const universityDegreeCredentialConfigurationSupportedMdoc = {
  format: OpenId4VciCredentialFormatProfile.MsoMdoc,
  scope: 'UniversityDegreeCredential',
  doctype: 'UniversityDegreeCredential',
  proof_types_supported: {
    jwt: {
      proof_signing_alg_values_supported: ['ES256', 'EdDSA'],
      key_attestations_required: {
        // TODO: enum for iso enum values
        key_storage: ['iso_18045_high'],
        user_authentication: ['iso_18045_high'],
      },
    },
  },
  cryptographic_binding_methods_supported: ['jwk'],
} satisfies OpenId4VciCredentialConfigurationSupportedWithFormats

const baseUrl = 'http://localhost:3991'
const issuerBaseUrl = `${baseUrl}/oid4vci`
const verifierBaseUrl = `${baseUrl}/oid4vp`

describe('OpenId4Vc Wallet and Key Attestations', () => {
  let expressApp: Express
  let clearNock: () => void

  let issuer: AgentType<{
    openid4vc: OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, OpenId4VcVerifierModuleConfigOptions>
  }>
  let issuerRecord: OpenId4VcIssuerRecord

  let holder: AgentType<{
    openid4vc: OpenId4VcModule
  }>

  let keyAttestationJwt: string
  let attestedKeys: Kms.PublicJwk[]
  let walletAttestationJwt: string

  beforeEach(async () => {
    expressApp = express()

    issuer = await createAgentFromModules({
      openid4vc: new OpenId4VcModule({
        issuer: {
          baseUrl: issuerBaseUrl,
          getVerificationSessionForIssuanceSessionAuthorization: async ({ issuanceSession, scopes }) => {
            if (scopes.includes(universityDegreeCredentialConfigurationSupportedMdoc.scope)) {
              const createRequestReturn = await issuer.agent.openid4vc.verifier.createAuthorizationRequest({
                verifierId: issuanceSession.issuerId,
                requestSigner: {
                  method: 'x5c',
                  x5c: [issuer.certificate],
                },
                responseMode: 'direct_post.jwt',
                dcql: {
                  query: {
                    credentials: [
                      {
                        id: 'e498bd12-be8f-4884-8ffe-2704176b99be',
                        format: 'vc+sd-jwt',
                        claims: [
                          {
                            path: ['given_name'],
                          },
                          {
                            path: ['family_name'],
                          },
                        ],
                        meta: {
                          vct_values: ['urn:eu.europa.ec.eudi:pid:1'],
                        },
                      },
                    ],
                  },
                },
              })

              return {
                ...createRequestReturn,
                scopes: [universityDegreeCredentialConfigurationSupportedMdoc.scope],
              }
            }

            throw new Error('Unsupported scope values')
          },
          credentialRequestToCredentialMapper: async ({ holderBinding, credentialConfiguration }) => {
            if (credentialConfiguration.format === OpenId4VciCredentialFormatProfile.MsoMdoc) {
              if (holderBinding.bindingMethod !== 'jwk') {
                throw new CredoError('Expected jwk binding method')
              }
              expect(holderBinding.keyAttestation?.payload.attested_keys).toHaveLength(10)
              expect(holderBinding.keyAttestation).toEqual({
                payload: {
                  iat: expect.any(Number),
                  exp: expect.any(Number),
                  attested_keys: expect.any(Array),
                  key_storage: ['iso_18045_high'],
                  user_authentication: ['iso_18045_high'],
                },
                header: {
                  alg: 'ES256',
                  typ: 'keyattestation+jwt',
                  x5c: [expect.any(String)],
                },
                signer: {
                  method: 'x5c',
                  x5c: [expect.any(String)],
                  alg: Kms.KnownJwaSignatureAlgorithms.ES256,
                  publicJwk: expect.any(Object),
                },
              })

              return {
                type: 'credentials',
                format: OpenId4VciCredentialFormatProfile.MsoMdoc,
                credentials: holderBinding.keys.map((holderBinding, index) => ({
                  docType: credentialConfiguration.doctype,
                  holderKey: holderBinding.jwk,
                  issuerCertificate: issuer.certificate,
                  namespaces: {
                    [credentialConfiguration.doctype]: {
                      index,
                    },
                  },
                  validityInfo: {
                    validFrom: new Date('2024-01-01'),
                    validUntil: new Date('2050-01-01'),
                  },
                })),
              }
            }

            throw new Error('not supported')
          },
        },
        verifier: {
          baseUrl: verifierBaseUrl,
        },
      }),
      inMemory: new InMemoryWalletModule({}),
    })

    holder = await createAgentFromModules({
      openid4vc: new OpenId4VcModule(),
      inMemory: new InMemoryWalletModule({}),
    })

    const walletProviderCertificate = await holder.agent.x509.createCertificate({
      authorityKey: Kms.PublicJwk.fromPublicJwk(
        (await holder.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
      ),
      issuer: {
        commonName: 'Credo Wallet Provider',
      },
    })

    const walletProvider = new Openid4vciWalletProvider({ callbacks: getOid4vcCallbacks(holder.agent.context) })
    walletAttestationJwt = await walletProvider.createWalletAttestationJwt({
      clientId: 'wallet',
      confirmation: {
        jwk: (await holder.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk as Jwk,
      },
      issuer: 'https://wallet-provider.com',
      signer: {
        method: 'x5c',
        alg: Kms.KnownJwaSignatureAlgorithms.ES256,
        x5c: [walletProviderCertificate.toString('base64url')],
        kid: walletProviderCertificate.publicJwk.keyId,
      },
      walletName: 'Credo Wallet',
      walletLink: 'https://credo.js.org',
      // 5 minutes
      expiresAt: addSecondsToDate(new Date(), 300),
    })

    attestedKeys = await Promise.all(
      new Array(10)
        .fill(0)
        .map(async () =>
          Kms.PublicJwk.fromPublicJwk(
            (await holder.agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk
          )
        )
    )

    keyAttestationJwt = await walletProvider.createKeyAttestationJwt({
      attestedKeys: attestedKeys.map((key) => key.toJson() as Jwk),
      signer: {
        method: 'x5c',
        alg: Kms.KnownJwaSignatureAlgorithms.ES256,
        x5c: [walletProviderCertificate.toString('base64url')],
        kid: walletProviderCertificate.publicJwk.keyId,
      },
      use: 'proof_type.jwt',
      keyStorage: ['iso_18045_high'],
      userAuthentication: ['iso_18045_high'],
      // 5 minutes
      expiresAt: addSecondsToDate(new Date(), 300),
    })

    // Trust wallet provider
    issuer.agent.x509.config.setTrustedCertificatesForVerification((_agentContext, { verification }) => {
      if (verification.type === 'oauth2ClientAttestation' || verification.type === 'openId4VciKeyAttestation') {
        return [walletProviderCertificate.toString('pem')]
      }

      // Use global trusted certificates
      return undefined
    })

    // Pre-store identity credential
    const holderIdentityCredential = await issuer.agent.sdJwtVc.sign({
      issuer: {
        method: 'x5c',
        x5c: [issuer.certificate],
        issuer: baseUrl,
      },
      payload: {
        vct: 'urn:eu.europa.ec.eudi:pid:1',
        given_name: 'Erika',
        family_name: 'Powerstar',
      },
      disclosureFrame: {
        _sd: ['given_name', 'family_name'],
      },
      holder: {
        method: 'jwk',
        jwk: holder.jwk,
      },
    })
    await holder.agent.sdJwtVc.store(holderIdentityCredential.compact)

    holder.agent.x509.config.addTrustedCertificate(issuer.certificate)
    issuer.agent.x509.config.addTrustedCertificate(issuer.certificate)

    issuerRecord = await issuer.agent.openid4vc.issuer.createIssuer({
      issuerId: '2f9c0385-7191-4c50-aa22-40cf5839d52b',
      dpopSigningAlgValuesSupported: [Kms.KnownJwaSignatureAlgorithms.ES256],
      batchCredentialIssuance: {
        batchSize: 10,
      },
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupportedMdoc,
      },
    })

    await issuer.agent.openid4vc.verifier.createVerifier({
      verifierId: issuerRecord.issuerId,
    })

    // We let AFJ create the router, so we have a fresh one each time
    expressApp.use('/oid4vci', issuer.agent.openid4vc.issuer.config.router)
    expressApp.use('/oid4vp', issuer.agent.openid4vc.verifier.config.router)
    clearNock = setupNockToExpress(baseUrl, expressApp)
  })

  afterEach(async () => {
    clearNock()
    await issuer.agent.shutdown()

    await holder.agent.shutdown()
  })

  it('e2e flow issuing a batch of mdoc based on wallet and key attestation', async () => {
    // Create offer for university degree
    const { issuanceSession, credentialOffer } = await issuer.agent.openid4vc.issuer.createCredentialOffer({
      issuerId: issuerRecord.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      preAuthorizedCodeFlowConfig: {},

      // Require DPoP and wallet attestations
      authorization: {
        requireDpop: true,
        requireWalletAttestation: true,
      },
    })

    // Resolve offer
    const resolvedCredentialOffer = await holder.agent.openid4vc.holder.resolveCredentialOffer(credentialOffer)

    // Request access token
    const tokenResponse = await holder.agent.openid4vc.holder.requestToken({
      resolvedCredentialOffer,
      walletAttestationJwt,
      clientId: 'wallet',
    })

    // Request credentials
    const credentialResponse = await holder.agent.openid4vc.holder.requestCredentials({
      resolvedCredentialOffer,
      ...tokenResponse,
      credentialBindingResolver: () => ({
        method: 'attestation',
        keyAttestationJwt,
      }),
    })

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Completed,
      issuanceSessionId: issuanceSession.id,
    })

    expect(credentialResponse.credentials).toHaveLength(1)
    expect(credentialResponse.credentials[0].credentials).toHaveLength(10)
    const credentials = credentialResponse.credentials[0].credentials

    for (const credentialIndex of credentials.keys()) {
      const credential = credentials[credentialIndex]
      if (credential.claimFormat !== ClaimFormat.MsoMdoc) {
        throw new Error('Expected mdoc')
      }

      expect(credential.deviceKey?.fingerprint).toEqual(attestedKeys[credentialIndex].fingerprint)
    }
  })

  it('e2e flow with presentation during issuance, issuing a batch of mdoc based on wallet and key attestation', async () => {
    // Create offer for university degree
    const { issuanceSession, credentialOffer } = await issuer.agent.openid4vc.issuer.createCredentialOffer({
      issuerId: issuerRecord.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {
        requirePresentationDuringIssuance: true,
      },

      // Require DPoP and wallet attestations
      authorization: {
        requireDpop: true,
        requireWalletAttestation: true,
      },
    })

    // Resolve offer
    const resolvedCredentialOffer = await holder.agent.openid4vc.holder.resolveCredentialOffer(credentialOffer)

    const resolvedAuthorizationRequest = await holder.agent.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(
      resolvedCredentialOffer,
      {
        clientId: 'wallet',
        redirectUri: 'something',
        walletAttestationJwt,
      }
    )

    if (resolvedAuthorizationRequest.authorizationFlow !== AuthorizationFlow.PresentationDuringIssuance) {
      throw new Error('expected presentation during issuance')
    }

    const resolvedPresentationRequest = await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      resolvedAuthorizationRequest.openid4vpRequestUrl
    )
    if (!resolvedPresentationRequest.dcql) {
      throw new Error('Missing dcql')
    }

    // Submit presentation
    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedPresentationRequest.dcql.queryResult
    )
    const openId4VpResult = await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedPresentationRequest.authorizationRequestPayload,
      dcql: {
        credentials: selectedCredentials,
      },
    })
    if (!openId4VpResult.ok) {
      throw new Error('not ok')
    }

    // Request authorization code
    const { authorizationCode, dpop } = await holder.agent.openid4vc.holder.retrieveAuthorizationCodeUsingPresentation({
      authSession: resolvedAuthorizationRequest.authSession,
      resolvedCredentialOffer,
      presentationDuringIssuanceSession: openId4VpResult.presentationDuringIssuanceSession,
      dpop: resolvedAuthorizationRequest.dpop,

      // TODO: should we dynamically retrieve the wallet attestation JWT based on a callback?
      walletAttestationJwt,
    })

    // Request access token
    const tokenResponse = await holder.agent.openid4vc.holder.requestToken({
      resolvedCredentialOffer,
      code: authorizationCode,
      dpop,
      walletAttestationJwt,
      clientId: 'wallet',
    })

    // Request credentials
    const credentialResponse = await holder.agent.openid4vc.holder.requestCredentials({
      resolvedCredentialOffer,
      clientId: 'wallet',
      ...tokenResponse,
      credentialBindingResolver: () => ({
        method: 'attestation',
        keyAttestationJwt,
      }),
    })

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Completed,
      issuanceSessionId: issuanceSession.id,
    })

    expect(credentialResponse.credentials).toHaveLength(1)
    expect(credentialResponse.credentials[0].credentials).toHaveLength(10)
  })

  it('throws error if wallet attestation required but not provided', async () => {
    // Create offer for university degree
    const { credentialOffer } = await issuer.agent.openid4vc.issuer.createCredentialOffer({
      issuerId: issuerRecord.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      authorizationCodeFlowConfig: {},
      preAuthorizedCodeFlowConfig: {},

      // Require DPoP and wallet attestations
      authorization: {
        requireDpop: true,
        requireWalletAttestation: true,
      },
    })

    // Resolve offer
    const resolvedCredentialOffer = await holder.agent.openid4vc.holder.resolveCredentialOffer(credentialOffer)

    await expect(
      holder.agent.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(resolvedCredentialOffer, {
        clientId: 'wallet',
        redirectUri: 'something',
      })
    ).rejects.toThrow('Missing required client attestation parameters in pushed authorization request')

    // Request pre-auth access token
    await expect(
      holder.agent.openid4vc.holder.requestToken({
        resolvedCredentialOffer,
        clientId: 'wallet',
      })
    ).rejects.toThrow('Missing required client attestation parameters in access token request')

    const resolvedAuthorizationRequest = await holder.agent.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(
      resolvedCredentialOffer,
      {
        clientId: 'wallet',
        redirectUri: 'something',
        walletAttestationJwt,
      }
    )

    if (resolvedAuthorizationRequest.authorizationFlow !== AuthorizationFlow.PresentationDuringIssuance) {
      throw new Error('expected presentation during issuance')
    }

    const resolvedPresentationRequest = await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      resolvedAuthorizationRequest.openid4vpRequestUrl
    )
    if (!resolvedPresentationRequest.dcql) {
      throw new Error('Missing dcql')
    }

    // Submit presentation
    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(
      resolvedPresentationRequest.dcql.queryResult
    )
    const openId4VpResult = await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedPresentationRequest.authorizationRequestPayload,
      dcql: {
        credentials: selectedCredentials,
      },
    })
    if (!openId4VpResult.ok) {
      throw new Error('not ok')
    }

    await expect(
      holder.agent.openid4vc.holder.retrieveAuthorizationCodeUsingPresentation({
        authSession: resolvedAuthorizationRequest.authSession,
        resolvedCredentialOffer,
        presentationDuringIssuanceSession: openId4VpResult.presentationDuringIssuanceSession,
        dpop: resolvedAuthorizationRequest.dpop,
      })
    ).rejects.toThrow('Missing required client attestation parameters in pushed authorization request')

    // Request authorization code
    const { authorizationCode, dpop } = await holder.agent.openid4vc.holder.retrieveAuthorizationCodeUsingPresentation({
      authSession: resolvedAuthorizationRequest.authSession,
      resolvedCredentialOffer,
      presentationDuringIssuanceSession: openId4VpResult.presentationDuringIssuanceSession,
      dpop: resolvedAuthorizationRequest.dpop,

      // TODO: should we dynamically retrieve the wallet attestation JWT based on a callback?
      walletAttestationJwt,
    })

    await expect(
      holder.agent.openid4vc.holder.requestToken({
        resolvedCredentialOffer,
        code: authorizationCode,
        dpop,
        clientId: 'wallet',
      })
    ).rejects.toThrow('Missing required client attestation parameters in access token request')

    // Request access token
    await expect(
      holder.agent.openid4vc.holder.requestToken({
        resolvedCredentialOffer,
        code: authorizationCode,
        dpop,
        walletAttestationJwt,
        clientId: 'wallet',
      })
    ).resolves.toMatchObject({
      accessToken: expect.any(String),
    })
  })

  it('throws error if key attestation required but not provided', async () => {
    // Create offer for university degree
    const { credentialOffer } = await issuer.agent.openid4vc.issuer.createCredentialOffer({
      issuerId: issuerRecord.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      preAuthorizedCodeFlowConfig: {},

      // Require DPoP and wallet attestations
      authorization: {
        requireDpop: true,
        requireWalletAttestation: false,
      },
    })

    // Resolve offer
    const resolvedCredentialOffer = await holder.agent.openid4vc.holder.resolveCredentialOffer(credentialOffer)

    // Request access token
    const tokenResponse = await holder.agent.openid4vc.holder.requestToken({
      resolvedCredentialOffer,
      clientId: 'wallet',
    })

    // Request credentials (client error)
    await expect(
      holder.agent.openid4vc.holder.requestCredentials({
        resolvedCredentialOffer,
        ...tokenResponse,
        credentialBindingResolver: () => ({
          method: 'jwk',
          keys: attestedKeys,
        }),
      })
    ).rejects.toThrow(
      // NOTE: this is a client error
      `Credential binding returned list of JWK keys, but credential configuration 'universityDegree' requires key attestations. Return a key attestation with binding method 'attestation'`
    )

    // Modify metadata to avoid client error
    const credentialConfigurationId = Object.keys(resolvedCredentialOffer.offeredCredentialConfigurations)[0]
    const proofsTypesSupported =
      resolvedCredentialOffer.metadata.credentialIssuer.credential_configurations_supported[credentialConfigurationId]
        .proof_types_supported
    if (proofsTypesSupported?.jwt) {
      proofsTypesSupported.jwt.key_attestations_required = undefined
    }

    // Request credentials (server error)
    await expect(
      holder.agent.openid4vc.holder.requestCredentials({
        resolvedCredentialOffer,
        ...tokenResponse,
        credentialBindingResolver: () => ({
          method: 'jwk',
          keys: attestedKeys,
        }),
      })
    ).rejects.toThrow(
      `Missing required key attestation. Key attestations are required for proof type 'jwt' in credentail configuration 'universityDegree'`
    )
  })
})
