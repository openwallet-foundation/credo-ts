import type { OpenId4VciCredentialBindingResolver } from '../src/openid4vc-holder'
import type { AgentType } from './utils'

import { CredoError, Kms } from '@credo-ts/core'
import express, { type Express } from 'express'

import { setupNockToExpress } from '../../../tests/nockToExpress'
import {
  OpenId4VcHolderModule,
  OpenId4VcIssuanceSessionState,
  OpenId4VcIssuerModule,
  OpenId4VciCredentialFormatProfile,
} from '../src'

import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { createAgentFromModules, waitForCredentialIssuanceSessionRecordSubject } from './utils'
import { universityDegreeCredentialConfigurationSupportedMdoc } from './utilsVci'

const baseUrl = 'http://localhost:3991'
const issuerBaseUrl = `${baseUrl}/oid4vci`

describe('OpenId4Vc Batch Issuance', () => {
  let expressApp: Express
  let clearNock: () => void

  let issuer: AgentType<{
    openId4VcIssuer: OpenId4VcIssuerModule
  }>

  let holder: AgentType<{
    openId4VcHolder: OpenId4VcHolderModule
  }>

  beforeEach(async () => {
    expressApp = express()

    issuer = await createAgentFromModules('issuer', {
      openId4VcIssuer: new OpenId4VcIssuerModule({
        baseUrl: issuerBaseUrl,
        credentialRequestToCredentialMapper: async ({ credentialRequestFormat, holderBinding }) => {
          if (credentialRequestFormat?.format === OpenId4VciCredentialFormatProfile.MsoMdoc) {
            if (holderBinding.bindingMethod !== 'jwk') {
              throw new CredoError('Expected jwk binding method')
            }
            return {
              format: OpenId4VciCredentialFormatProfile.MsoMdoc,
              credentials: holderBinding.keys.map((holderBinding, index) => ({
                docType: credentialRequestFormat.doctype,
                holderKey: holderBinding.jwk,
                issuerCertificate: issuer.certificate,
                namespaces: {
                  [credentialRequestFormat.doctype]: {
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
      }),
      inMemory: new InMemoryWalletModule(),
    })

    holder = await createAgentFromModules('holder', {
      openId4VcHolder: new OpenId4VcHolderModule(),
      inMemory: new InMemoryWalletModule(),
    })

    holder.agent.x509.config.addTrustedCertificate(issuer.certificate.toString('base64'))
    issuer.agent.x509.config.addTrustedCertificate(issuer.certificate.toString('base64'))

    // We let AFJ create the router, so we have a fresh one each time
    expressApp.use('/oid4vci', issuer.agent.modules.openId4VcIssuer.config.router)
    clearNock = setupNockToExpress(baseUrl, expressApp)
  })

  afterEach(async () => {
    clearNock()
    await issuer.agent.shutdown()
    await holder.agent.shutdown()
  })

  const credentialBindingResolver: OpenId4VciCredentialBindingResolver = async ({
    agentContext,
    proofTypes,
    issuerMaxBatchSize,
  }) => {
    const kms = agentContext.resolve(Kms.KeyManagementApi)
    return {
      method: 'jwk',
      keys: await Promise.all(
        new Array(issuerMaxBatchSize).fill(0).map(async () =>
          Kms.PublicJwk.fromPublicJwk(
            (
              await kms.createKeyForSignatureAlgorithm({
                algorithm: proofTypes.jwt?.supportedSignatureAlgorithms[0] ?? 'EdDSA',
              })
            ).publicJwk
          )
        )
      ),
    }
  }

  it('e2e flow issuing a batch of mdoc', async () => {
    const issuerRecord = await issuer.agent.modules.openId4VcIssuer.createIssuer({
      issuerId: '2f9c0385-7191-4c50-aa22-40cf5839d52b',
      batchCredentialIssuance: {
        batchSize: 10,
      },
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupportedMdoc,
      },
    })

    // Create offer for university degree
    const { issuanceSession, credentialOffer } = await issuer.agent.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: issuerRecord.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      preAuthorizedCodeFlowConfig: {},
    })

    // Resolve offer
    const resolvedCredentialOffer = await holder.agent.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)

    // Request access token
    const tokenResponse = await holder.agent.modules.openId4VcHolder.requestToken({
      resolvedCredentialOffer,
    })

    // Request credentials
    const credentialResponse = await holder.agent.modules.openId4VcHolder.requestCredentials({
      resolvedCredentialOffer,
      ...tokenResponse,
      credentialBindingResolver,
    })

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Completed,
      issuanceSessionId: issuanceSession.id,
    })

    expect(credentialResponse.credentials).toHaveLength(1)
    expect(credentialResponse.credentials[0].credentials).toHaveLength(10)
  })

  it('e2e flow requesting a batch of mdoc larger than max batch size', async () => {
    const issuerRecord = await issuer.agent.modules.openId4VcIssuer.createIssuer({
      issuerId: '2f9c0385-7191-4c50-aa22-40cf5839d52b',
      batchCredentialIssuance: {
        batchSize: 10,
      },
      credentialConfigurationsSupported: {
        universityDegree: universityDegreeCredentialConfigurationSupportedMdoc,
      },
    })

    const { credentialOffer } = await issuer.agent.modules.openId4VcIssuer.createCredentialOffer({
      issuerId: issuerRecord.issuerId,
      credentialConfigurationIds: ['universityDegree'],
      preAuthorizedCodeFlowConfig: {},
    })

    // Resolve offer
    const resolvedCredentialOffer = await holder.agent.modules.openId4VcHolder.resolveCredentialOffer(credentialOffer)

    // Request access token
    const tokenResponse = await holder.agent.modules.openId4VcHolder.requestToken({
      resolvedCredentialOffer,
    })

    // Request credentials
    await expect(
      holder.agent.modules.openId4VcHolder.requestCredentials({
        resolvedCredentialOffer,
        ...tokenResponse,
        credentialBindingResolver: async ({ agentContext, proofTypes }) => {
          const kms = agentContext.resolve(Kms.KeyManagementApi)
          return {
            method: 'jwk',
            keys: await Promise.all(
              new Array(12).fill(0).map(async () =>
                Kms.PublicJwk.fromPublicJwk(
                  (
                    await kms.createKeyForSignatureAlgorithm({
                      algorithm: proofTypes.jwt?.supportedSignatureAlgorithms[0] ?? 'EdDSA',
                    })
                  ).publicJwk
                )
              )
            ),
          } as const
        },
      })
    ).rejects.toThrow(
      'Issuer supports issuing a batch of maximum 10 credential(s). Binding resolver returned 12 keys. Make sure the returned value does not exceed the max batch issuance.'
    )
  })
})
