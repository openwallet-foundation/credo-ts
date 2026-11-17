import type { SdJwtVcRecord } from '@credo-ts/core'
import { X509Module } from '@credo-ts/core'
import express, { type Express } from 'express'

import { InMemoryWalletModule } from '../../../tests/InMemoryWalletModule'
import { setupNockToExpress } from '../../../tests/nockToExpress'
import type { OpenId4VcIssuerModuleConfigOptions, OpenId4VcVerifierModuleConfigOptions } from '../../openid4vc/src'
import { OpenId4VcIssuanceSessionState, OpenId4VcModule, OpenId4VcVerificationSessionState } from '../../openid4vc/src'
import type { OpenId4VciCredentialBindingResolver } from '../../openid4vc/src/openid4vc-holder'
import {
  createAgentFromModules,
  waitForCredentialIssuanceSessionRecordSubject,
  waitForVerificationSessionRecordSubject,
} from '../../openid4vc/tests/utils'
import { universityDegreeCredentialConfigurationSupported } from '../../openid4vc/tests/utilsVci'
import type { CheqdDidCreateOptions } from '../src'
import { cheqdPayerSeeds, getCheqdModules } from './setupCheqdModule'

// Payer seed [5] is used by this file only. The holder never writes to the ledger.
const payerSeed = cheqdPayerSeeds[5]

const baseUrl = 'http://localhost:1234'
const issuanceBaseUrl = `${baseUrl}/oid4vci`
const verificationBaseUrl = `${baseUrl}/oid4vp`

describe('OpenID4VC with did:cheqd', () => {
  let app: Express
  let clearNock: () => void
  let issuerDid: string
  let issuerDidUrl: string
  let verifierDid: string
  let verifierDidUrl: string

  let issuer: Awaited<ReturnType<typeof createIssuer>>
  let verifier: Awaited<ReturnType<typeof createVerifier>>
  let holder: Awaited<ReturnType<typeof createHolder>>

  // The issuer signs every credential with its P-256 did:cheqd key; the holder binds to its did:key
  const createIssuer = () =>
    createAgentFromModules(
      {
        ...getCheqdModules(payerSeed),
        x509: new X509Module(),
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule<OpenId4VcIssuerModuleConfigOptions, undefined>({
          app,
          issuer: {
            baseUrl: issuanceBaseUrl,
            credentialRequestToCredentialMapper: async ({ credentialConfiguration, holderBinding }) => ({
              type: 'credentials',
              format: 'dc+sd-jwt',
              credentials: holderBinding.keys.map((holder) => ({
                payload: { vct: credentialConfiguration.vct as string, university: 'innsbruck', degree: 'bachelor' },
                holder,
                issuer: { method: 'did', didUrl: issuerDidUrl },
                disclosureFrame: { _sd: ['university', 'degree'] },
              })),
            }),
          },
        }),
      },
      '96213c3d7fc8d4d6754c7a0fd969598a',
      global.fetch
    )

  const createVerifier = () =>
    createAgentFromModules(
      {
        ...getCheqdModules(payerSeed),
        x509: new X509Module(),
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule<undefined, OpenId4VcVerifierModuleConfigOptions>({
          app,
          verifier: { baseUrl: verificationBaseUrl },
        }),
      },
      '96213c3d7fc8d4d6754c7a0fd969598b',
      global.fetch
    )

  const createHolder = () =>
    createAgentFromModules(
      {
        ...getCheqdModules(payerSeed),
        x509: new X509Module(),
        inMemory: new InMemoryWalletModule(),
        openid4vc: new OpenId4VcModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598c',
      global.fetch
    )

  const createCheqdDid = async (agent: { dids: typeof issuer.agent.dids }) => {
    const created = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: { createKey: { type: { kty: 'EC', crv: 'P-256' } }, network: 'testnet' },
    })
    expect(created.didState.state).toBe('finished')
    return created.didState.did as string
  }

  beforeAll(async () => {
    app = express()
    issuer = await createIssuer()
    verifier = await createVerifier()
    holder = await createHolder()

    // one write at a time from the payer account
    issuerDid = await createCheqdDid(issuer.agent)
    issuerDidUrl = `${issuerDid}#key-1`
    verifierDid = await createCheqdDid(verifier.agent)
    verifierDidUrl = `${verifierDid}#key-1`

    clearNock = setupNockToExpress(baseUrl, app)
  })

  afterAll(async () => {
    clearNock()
    await Promise.all([issuer.agent.shutdown(), verifier.agent.shutdown(), holder.agent.shutdown()])
  })

  const credentialBindingResolver: OpenId4VciCredentialBindingResolver = () => ({
    method: 'did',
    didUrls: [holder.verificationMethod.id],
  })

  const issueToHolder = async () => {
    const { issuerId } = await issuer.agent.openid4vc.issuer.createIssuer({
      credentialConfigurationsSupported: { universityDegree: universityDegreeCredentialConfigurationSupported },
    })
    const { issuanceSession, credentialOffer } = await issuer.agent.openid4vc.issuer.createCredentialOffer({
      issuerId,
      credentialConfigurationIds: ['universityDegree'],
      preAuthorizedCodeFlowConfig: {},
      version: 'v1',
    })

    const resolvedCredentialOffer = await holder.agent.openid4vc.holder.resolveCredentialOffer(credentialOffer)
    const tokenResponse = await holder.agent.openid4vc.holder.requestToken({ resolvedCredentialOffer })
    const credentialResponse = await holder.agent.openid4vc.holder.requestCredentials({
      resolvedCredentialOffer,
      ...tokenResponse,
      credentialBindingResolver,
    })

    await waitForCredentialIssuanceSessionRecordSubject(issuer.replaySubject, {
      state: OpenId4VcIssuanceSessionState.Completed,
      issuanceSessionId: issuanceSession.id,
      contextCorrelationId: issuer.agent.context.contextCorrelationId,
    })
    return credentialResponse
  }

  let received: SdJwtVcRecord

  it('issues an SD-JWT VC signed by the P-256 did:cheqd key, bound to the holder did:key', async () => {
    const response = await issueToHolder()

    expect(response.credentials).toHaveLength(1)
    received = response.credentials[0].record as SdJwtVcRecord
    await holder.agent.sdJwtVc.store({ record: received })

    const credential = received.firstCredential
    expect(credential.payload.iss).toBe(issuerDid)
    expect(credential.payload.vct).toBe('UniversityDegreeCredential')
    expect(credential.header.alg).toBe('ES256')
    expect(credential.holder).toMatchObject({ method: 'did', didUrl: holder.verificationMethod.id })

    // the holder resolves the issuer did from the ledger and checks the signature
    const verified = await holder.agent.sdJwtVc.verify({ compactSdJwtVc: credential.compact })
    expect(verified.isValid, verified.isValid ? '' : String(verified.error)).toBe(true)
  })

  it('presents it to a verifier whose request is signed by its own did:cheqd, and the verifier accepts it', async () => {
    const { verifierId } = await verifier.agent.openid4vc.verifier.createVerifier({})
    const { authorizationRequest, verificationSession } =
      await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
        verifierId,
        // the client id of the request becomes decentralized_identifier:<did>
        requestSigner: { method: 'did', didUrl: verifierDidUrl },
        dcql: {
          query: {
            credentials: [
              {
                id: 'UniversityDegree',
                format: 'dc+sd-jwt',
                meta: { vct_values: ['UniversityDegreeCredential'] },
                claims: [{ path: ['university'] }],
              },
            ],
          },
        },
        version: 'v1',
      })

    expect(authorizationRequest).toContain(`client_id=decentralized_identifier%3A${encodeURIComponent(verifierDid)}`)

    // the holder resolves the verifier did from the ledger to check the signed request
    const resolved = await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)
    if (!resolved.dcql) throw new Error('Expected a DCQL query')
    expect(resolved.verifier).toMatchObject({ clientIdPrefix: 'decentralized_identifier' })

    const selected = holder.agent.openid4vc.holder.selectCredentialsForDcqlRequest(resolved.dcql.queryResult)
    const { serverResponse } = await holder.agent.openid4vc.holder.acceptOpenId4VpAuthorizationRequest({
      authorizationRequestPayload: resolved.authorizationRequestPayload,
      dcql: { credentials: selected },
    })
    expect(serverResponse).toMatchObject({ status: 200 })

    await waitForVerificationSessionRecordSubject(verifier.replaySubject, {
      contextCorrelationId: verifier.agent.context.contextCorrelationId,
      state: OpenId4VcVerificationSessionState.ResponseVerified,
      verificationSessionId: verificationSession.id,
    })

    // the verifier resolved the issuer did from the ledger to verify the credential it received
    const { dcql } = await verifier.agent.openid4vc.verifier.getVerifiedAuthorizationResponse(verificationSession.id)
    expect(dcql?.presentations.UniversityDegree).toHaveLength(1)
    const presentation = dcql?.presentations.UniversityDegree[0] as { prettyClaims: Record<string, unknown> }
    expect(presentation.prettyClaims).toMatchObject({ iss: issuerDid, university: 'innsbruck' })
    // only the requested claim was disclosed
    expect(presentation.prettyClaims).not.toHaveProperty('degree')
  })

  it('finds nothing to present for a credential type the holder does not have', async () => {
    const { verifierId } = await verifier.agent.openid4vc.verifier.createVerifier({})
    const { authorizationRequest } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
      verifierId,
      requestSigner: { method: 'did', didUrl: verifierDidUrl },
      dcql: {
        query: {
          credentials: [{ id: 'Other', format: 'dc+sd-jwt', meta: { vct_values: ['SomethingElse'] } }],
        },
      },
      version: 'v1',
    })

    const resolved = await holder.agent.openid4vc.holder.resolveOpenId4VpAuthorizationRequest(authorizationRequest)
    expect(resolved.dcql?.queryResult.can_be_satisfied).toBe(false)
  })
})
