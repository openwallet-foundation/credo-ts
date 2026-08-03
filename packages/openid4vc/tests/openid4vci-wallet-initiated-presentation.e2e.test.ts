import type { DifPresentationExchangeDefinitionV2, SdJwtVc, SdJwtVcIssuer } from '@credo-ts/core'
import { ClaimFormat, SdJwtVcRecord } from '@credo-ts/core'
import { AuthorizationFlow } from '@openid4vc/openid4vci'
import express, { type Express } from 'express'
import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import {
  authorizationCodeGrantIdentifier,
  OpenId4VcIssuanceSessionState,
  type OpenId4VcIssuerModuleConfigOptions,
  type OpenId4VciGetDynamicIssuanceSession,
  type OpenId4VciGetVerificationSession,
  type OpenId4VciResolvedCredentialOffer,
  type OpenId4VciSignSdJwtCredentials,
  OpenId4VcModule,
  type OpenId4VcVerifierModuleConfigOptions,
} from '../src'
import type { OpenId4VciCredentialBindingResolver } from '../src/openid4vc-holder'
import type { AgentType } from './utils'
import { createAgentFromModules, waitForCredentialIssuanceSessionRecordSubject } from './utils'
import { universityDegreeCredentialConfigurationSupported } from './utilsVci'

const presentationDefinition = {
  id: 'a34cff9d-a825-4283-9d9a-e84f97ebdd08',
  input_descriptors: [
    {
      id: 'e498bd12-be8f-4884-8ffe-2704176b99be',
      name: 'Identity Credential',
      purpose: 'To issue your university degree we need to verify your identity',
      constraints: {
        limit_disclosure: 'required',
        fields: [
          {
            path: ['$.vct'],
            filter: { type: 'string', const: 'urn:eu.europa.ec.eudi:pid:1' },
          },
          { path: ['$.given_name'], filter: { type: 'string' } },
          { path: ['$.family_name'], filter: { type: 'string' } },
        ],
      },
    },
  ],
} as const satisfies DifPresentationExchangeDefinitionV2

const baseUrl = 'http://localhost:4872'
const issuerBaseUrl = `${baseUrl}/oid4vci`
const verifierBaseUrl = `${baseUrl}/oid4vp`

describe('OpenId4Vc (Wallet Initiated Presentation During Issuance)', () => {
  let expressApp: Express
  let clearNock: () => void

  let issuer: AgentType<{
    openid4vc: OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, OpenId4VcVerifierModuleConfigOptions>
  }>

  let holder: AgentType<{
    openid4vc: OpenId4VcModule
  }>

  const getVerificationSession: OpenId4VciGetVerificationSession = async ({ issuanceSession, scopes }) => {
    if (scopes.includes(universityDegreeCredentialConfigurationSupported.scope)) {
      const createRequestReturn = await issuer.agent.openid4vc.verifier.createAuthorizationRequest({
        verifierId: issuanceSession.issuerId,
        requestSigner: { method: 'x5c', x5c: [issuer.certificate] },
        version: 'v1.draft24',
        responseMode: 'direct_post.jwt',
        presentationExchange: { definition: presentationDefinition },
      })

      return {
        ...createRequestReturn,
        scopes: [universityDegreeCredentialConfigurationSupported.scope],
      }
    }

    throw new Error('Unsupported scope values')
  }

  // Dynamic (wallet-initiated) session that uses the presentation during issuance flow.
  const getDynamicIssuanceSession: OpenId4VciGetDynamicIssuanceSession = async (options) => {
    if (
      options.origin !== 'authorizationChallengeRequest' ||
      !options.supportedAuthorizationFlows.includes('presentation')
    ) {
      throw new Error('Expected presentation flow to be supported on the authorization challenge endpoint')
    }

    return {
      authorizationFlow: 'presentation',
      credentialConfigurationIds: Object.keys(options.requestedCredentialConfigurations),
    }
  }

  beforeEach(async () => {
    expressApp = express()

    issuer = await createAgentFromModules(
      {
        openid4vc: new OpenId4VcModule({
          app: expressApp,
          verifier: { baseUrl: verifierBaseUrl },
          issuer: {
            baseUrl: issuerBaseUrl,
            getVerificationSession,
            getDynamicIssuanceSession,
            credentialRequestToCredentialMapper: async ({ holderBinding, verification, credentialConfiguration }) => {
              if (!verification?.presentationExchange) {
                throw new Error('Expected presentation exchange verification in credential request mapper')
              }

              const descriptor = verification.presentationExchange.descriptors.find(
                (descriptor) => descriptor.descriptor.id === presentationDefinition.input_descriptors[0].id
              )
              if (!descriptor || descriptor.claimFormat !== ClaimFormat.SdJwtDc) {
                throw new Error('Expected descriptor with sd-jwt vc format')
              }
              const credential: SdJwtVc = descriptor.credential
              const fullName = `${credential.prettyClaims.given_name} ${credential.prettyClaims.family_name}`

              if (credentialConfiguration.format === 'vc+sd-jwt' && credentialConfiguration.vct) {
                return {
                  type: 'credentials',
                  format: 'dc+sd-jwt',
                  credentials: holderBinding.keys.map((holderBinding) => ({
                    payload: { vct: credentialConfiguration.vct, full_name: fullName, degree: 'Software Engineer' },
                    holder: holderBinding,
                    issuer: { method: 'x5c', x5c: [issuer.certificate], issuer: baseUrl },
                    disclosureFrame: { _sd: ['full_name'] },
                  })),
                } satisfies OpenId4VciSignSdJwtCredentials
              }
              throw new Error('Invalid request')
            },
          },
        }),
        inMemory: new InMemoryWalletModule(),
      },
      undefined,
      global.fetch
    )

    holder = await createAgentFromModules(
      {
        openid4vc: new OpenId4VcModule(),
        inMemory: new InMemoryWalletModule(),
      },
      undefined,
      global.fetch
    )

    holder.agent.x509.config.addTrustedCertificate(issuer.certificate)
    issuer.agent.x509.config.addTrustedCertificate(issuer.certificate)

    clearNock = setupNockToExpress(baseUrl, expressApp)
  })

  afterEach(async () => {
    clearNock()

    await issuer.agent.shutdown()
    await holder.agent.shutdown()
  })

  const credentialBindingResolver: OpenId4VciCredentialBindingResolver = () => ({
    method: 'jwk',
    keys: [holder.jwk],
  })

  /**
   * Builds a synthetic resolved credential offer pointing at the issuer metadata, with an
   * `authorization_code` grant that does NOT include an `issuer_state`. Passing this through the
   * holder authorization flow results in an authorization challenge request without `issuer_state`,
   * i.e. a wallet-initiated issuance request.
   */
  async function resolveWalletInitiatedOffer(issuerId: string): Promise<OpenId4VciResolvedCredentialOffer> {
    const metadata = await holder.agent.openid4vc.holder.resolveIssuerMetadata(`${issuerBaseUrl}/${issuerId}`)

    return {
      metadata,
      offeredCredentialConfigurations: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
      credentialOfferPayload: {
        credential_issuer: metadata.credentialIssuer.credential_issuer,
        credential_configuration_ids: ['universityDegree'],
        grants: {
          [authorizationCodeGrantIdentifier]: {},
        },
      },
    } as OpenId4VciResolvedCredentialOffer
  }

  it('issues a credential through wallet-initiated presentation during issuance', async () => {
    const issuerRecord = await issuer.agent.openid4vc.issuer.createIssuer({
      issuerId: '2f9c0385-7191-4c50-aa22-40cf5839d52c',
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupported,
      },
    })

    const x5cIssuer = {
      method: 'x5c',
      x5c: [issuer.certificate],
      issuer: baseUrl,
    } satisfies SdJwtVcIssuer

    await issuer.agent.openid4vc.verifier.createVerifier({
      verifierId: '2f9c0385-7191-4c50-aa22-40cf5839d52c',
    })

    // Pre-store identity credential the holder will present
    const holderIdentityCredential = await issuer.agent.sdJwtVc.sign({
      issuer: x5cIssuer,
      payload: {
        vct: 'urn:eu.europa.ec.eudi:pid:1',
        given_name: 'Erika',
        family_name: 'Powerstar',
      },
      disclosureFrame: { _sd: ['given_name', 'family_name'] },
      holder: { method: 'jwk', jwk: holder.jwk },
    })
    holderIdentityCredential.kmsKeyId = holder.jwk.keyId
    await holder.agent.sdJwtVc.store({ record: SdJwtVcRecord.fromSdJwtVc(holderIdentityCredential) })

    // No credential offer; synthesize a wallet-initiated authorization flow
    const resolvedCredentialOffer = await resolveWalletInitiatedOffer(issuerRecord.issuerId)
    const resolvedAuthorization = await holder.agent.openid4vc.holder.resolveOpenId4VciAuthorizationRequest(
      resolvedCredentialOffer,
      {
        clientId: 'foo',
        redirectUri: 'http://localhost:1234/redirect',
        scope: ['UniversityDegreeCredential'],
      }
    )

    if (resolvedAuthorization.authorizationFlow !== AuthorizationFlow.PresentationDuringIssuance) {
      throw new Error(`Expected PresentationDuringIssuance flow, got ${resolvedAuthorization.authorizationFlow}`)
    }

    const resolvedPresentationRequest = await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(
      resolvedAuthorization.openid4vpRequestUrl
    )
    if (!resolvedPresentationRequest.presentationExchange) {
      throw new Error('Missing presentation exchange')
    }

    const selectedCredentials = holder.agent.openid4vc.holder.selectCredentialsForPresentationExchangeRequest(
      resolvedPresentationRequest.presentationExchange.credentialsForRequest
    )
    const openId4VpResult = await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolvedPresentationRequest.authorizationRequestPayload,
      presentationExchange: { credentials: selectedCredentials },
    })
    expect(openId4VpResult.ok).toEqual(true)
    if (!openId4VpResult.ok) {
      throw new Error('not ok')
    }

    const { authorizationCode } = await holder.agent.openid4vc.holder.retrieveAuthorizationCodeUsingPresentation({
      authSession: resolvedAuthorization.authSession,
      resolvedCredentialOffer,
      presentationDuringIssuanceSession: openId4VpResult.presentationDuringIssuanceSession,
    })

    const tokenResponse = await holder.agent.openid4vc.holder.requestToken({
      resolvedCredentialOffer,
      code: authorizationCode,
      clientId: 'foo',
      redirectUri: 'http://localhost:1234/redirect',
    })

    const credentialResponse = await holder.agent.openid4vc.holder.requestCredentials({
      resolvedCredentialOffer,
      ...tokenResponse,
      clientId: 'foo',
      credentialBindingResolver,
    })

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Completed,
    })

    expect(credentialResponse.credentials).toHaveLength(1)
    const firstSdJwtVc = (credentialResponse.credentials[0].record as SdJwtVcRecord).firstCredential
    expect(firstSdJwtVc.payload.vct).toEqual(universityDegreeCredentialConfigurationSupported.vct)
    expect(firstSdJwtVc.prettyClaims.full_name).toEqual('Erika Powerstar')
  })
})
