/**
 * OID4VP verifier conformance test.
 *
 * Runs the OpenID Foundation `oid4vp-1final-verifier-haip-test-plan` against a real
 * credo-ts OpenId4VcVerifier. The conformance suite (running in Docker, see
 * `oidf-setup.ts`) plays the wallet: it fetches the signed authorization
 * request from the verifier and posts the authorization response back, while
 * credo-ts verifies it.
 *
 * The verifier is served over real HTTPS on `host.testcontainers.internal:9382`
 * (exposed to the suite containers) — unlike the rest of the openid4vc e2e
 * tests, which intercept HTTP with nock and never bind a socket.
 *
 * Adapted from the OpenWallet Foundation EUDIPLO conformance presentation spec:
 * https://github.com/openwallet-foundation/eudiplo/tree/main/apps/backend/test/oidf
 */

import { readFileSync } from 'node:fs'
import { createServer, type Server } from 'node:https'
import { resolve } from 'node:path'
import type { DcqlQuery, X509Certificate } from '@credo-ts/core'
import { ClaimFormat, Kms, Mdoc, X509KeyUsage } from '@credo-ts/core'
import express, { type Express } from 'express'
import { Agent as UndiciAgent } from 'undici'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { InMemoryWalletModule } from '../../../../tests/InMemoryWalletModule'
import { OpenId4VcModule, type OpenId4VcVerifierModuleConfigOptions, type OpenId4VcVerifierRecord } from '../../src'
import type { AgentType } from '../utils'
import { createAgentFromModules } from '../utils'
import { HOST_VERIFIER_PORT, OIDF_HTTPD_CA_PATH, useOidfContainers } from './oidf-setup'
import { OIDFSuite } from './oidf-suite'
import { generateConformanceKeyMaterial } from './tls'

// The suite reaches the verifier from inside its Docker network, so the
// verifier's public base url uses the testcontainers host alias, not localhost.
const PUBLIC_HOSTNAME = 'host.testcontainers.internal'
const PUBLIC_HOST = `${PUBLIC_HOSTNAME}:${HOST_VERIFIER_PORT}`
const VERIFIER_BASE_URL = `https://${PUBLIC_HOST}/oid4vp`

// After a successful direct_post(.jwt), the verifier returns this redirect_uri
// and the suite (wallet) follows it expecting a 200. Served by a dedicated route
// on the same HTTPS server as the verifier.
const REDIRECT_PATH = '/conformance/response-redirect'
const AUTHORIZATION_RESPONSE_REDIRECT_URI = `https://${PUBLIC_HOST}${REDIRECT_PATH}`

// Conformance suite API/UI, reachable on the host via the nginx frontend.
const OIDF_URL = process.env.OIDF_TEST_URL ?? 'https://localhost:8443'
const OIDF_DEMO_TOKEN = process.env.OIDF_DEMO_TOKEN

// Optional filter so a subset of modules can be iterated on locally:
//   OIDF_MODULES=happy-flow,metadata pnpm test:conformance
const MODULE_FILTERS = (process.env.OIDF_MODULES ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0)

const VERIFIER_PLAN_NAME = 'oid4vp-1final-verifier-haip-test-plan'

type VerifierVariant = {
  credential_format: 'sd_jwt_vc' | 'iso_mdl'
  response_mode: 'direct_post.jwt'
}

const VERIFIER_VARIANT_MATRIX: readonly VerifierVariant[] = [
  {
    credential_format: 'sd_jwt_vc',
    response_mode: 'direct_post.jwt',
  },
  {
    credential_format: 'iso_mdl',
    response_mode: 'direct_post.jwt',
  },
] as const

const variantLabel = (variant: VerifierVariant) => variant.credential_format

// DCQL queries sent for each credential format. The conformance wallet holds
// matching credentials provisioned from the plan configuration.
const SD_JWT_VC_DCQL: DcqlQuery = {
  credentials: [
    {
      id: 'pid',
      format: 'dc+sd-jwt',
      meta: { vct_values: ['urn:eudi:pid:1'] },
      claims: [{ path: ['family_name'] }, { path: ['given_name'] }],
    },
  ],
}

const MDOC_DCQL: DcqlQuery = {
  credentials: [
    {
      id: 'mdl',
      format: ClaimFormat.MsoMdoc,
      meta: { doctype_value: 'org.iso.18013.5.1.mDL' },
      // OID4VP 1.0 final requires mdoc claims to use the claims-path-pointer
      // form `path: [namespace, data_element_identifier]`. The older
      // `{ namespace, claim_name }` form is rejected by the conformance suite
      // (requirement OID4VP-1FINAL-6).
      claims: [{ path: ['org.iso.18013.5.1', 'family_name'] }, { path: ['org.iso.18013.5.1', 'given_name'] }],
    },
  ],
}

const dcqlForVariant = (variant: VerifierVariant): DcqlQuery =>
  variant.credential_format === 'iso_mdl' ? MDOC_DCQL : SD_JWT_VC_DCQL

useOidfContainers()

describe('OIDF - oid4vp-1final-verifier-haip-test-plan', () => {
  let app: Express
  let server: Server
  let verifier: AgentType<{
    openid4vc: OpenId4VcModule<undefined, OpenId4VcVerifierModuleConfigOptions>
    inMemory: InMemoryWalletModule
  }>
  let openIdVerifier: OpenId4VcVerifierRecord
  let verifierCertificate: X509Certificate
  let caCertificate: X509Certificate

  const oidfSuite = new OIDFSuite(OIDF_URL, OIDF_DEMO_TOKEN)
  const createdPlans: Array<{ planId: string; variant: VerifierVariant; modules: string[] }> = []
  const executedPlanIds = new Set<string>()

  // undici dispatcher that trusts the conformance httpd CA, used when handing
  // the authorization request to the suite runner.
  let oidfDispatcher: UndiciAgent

  const skipReason = (moduleName: string): string | undefined => {
    if (MODULE_FILTERS.length > 0 && !MODULE_FILTERS.some((filter) => moduleName.includes(filter))) {
      return 'filtered out by OIDF_MODULES'
    }
    return undefined
  }

  // Happy-flow modules must PASS; negative/edge modules may legitimately come
  // back FAILED/WARNING, metadata modules WARNING/SKIPPED.
  const allowedResults = (moduleName: string): string[] => {
    const signal = moduleName.toLowerCase()

    // FIXME: will be addressed once merged and updated:
    // https://github.com/openwallet-foundation/sd-jwt-js/pull/378
    if (
      signal.includes('oid4vp-1final-verifier-kb-jwt-iat-in-past') ||
      signal.includes('oid4vp-1final-verifier-kb-jwt-iat-in-future')
    )
      return ['PASSED', 'WARNING', 'SKIPPED', 'FAILED']

    return ['PASSED', 'WARNING', 'SKIPPED']
  }

  /**
   * Drives one suite module: wait for the runner, create a signed authorization
   * request, hand it to the runner's `/authorize` endpoint, and wait for a
   * terminal result.
   */
  const runModule = async (planId: string, variant: VerifierVariant, moduleName: string) => {
    executedPlanIds.add(planId)

    const testInstance = await oidfSuite.startTest(planId, moduleName)
    await oidfSuite.waitForWaiting(testInstance.id)

    const { authorizationRequest } = await verifier.agent.openid4vc.verifier.createAuthorizationRequest({
      verifierId: openIdVerifier.verifierId,
      // x5c carries the leaf only: the suite rejects a self-signed root CA in the
      // chain (it must be trusted out-of-band, not transported in the header).
      requestSigner: { method: 'x5c', x5c: [verifierCertificate], clientIdPrefix: 'x509_hash' },
      responseMode: variant.response_mode,
      dcql: { query: dcqlForVariant(variant) },
      version: 'v1',
      authorizationResponseRedirectUri: AUTHORIZATION_RESPONSE_REDIRECT_URI,
    })

    // Hand the request to the suite wallet. It extracts the params, fetches the
    // request object from the verifier, builds a response and posts it back.
    const queryStart = authorizationRequest.indexOf('?')
    if (queryStart === -1) {
      throw new Error(`Authorization request missing query parameters: ${authorizationRequest}`)
    }
    const queryString = authorizationRequest.substring(queryStart)

    // The suite builds `testInstance.url` from its container-internal `base_url`
    // (`host.testcontainers.internal:8443`), which only resolves inside Docker.
    // We're calling from the host, so rewrite the origin to the host-reachable
    // suite URL (`OIDF_URL`, e.g. `https://localhost:8443`).
    const hostReachableUrl = new URL(testInstance.url)
    const oidfOrigin = new URL(OIDF_URL)
    hostReachableUrl.protocol = oidfOrigin.protocol
    hostReachableUrl.host = oidfOrigin.host

    const authorizeUrl = `${hostReachableUrl.toString()}/authorize${queryString}`
    // The suite's `/authorize` redirects to the verifier's `request_uri`
    // (`host.testcontainers.internal:9382`), which only resolves inside Docker.
    // We only need the suite to receive the request — it fetches the request_uri
    // itself from within the Docker network — so we must NOT follow the redirect
    // (the host cannot resolve that alias). A 3xx here is the expected success.
    const response = await fetch(authorizeUrl, { dispatcher: oidfDispatcher, redirect: 'manual' })
    // `redirect: 'manual'` yields an opaque-redirect response (status 0) for the
    // expected 3xx; only a real 4xx/5xx is a failure.
    if (response.status >= 400) {
      const text = await response.text().catch(() => '')
      throw new Error(`OIDF authorize call failed (${response.status}): ${text}`)
    }
    const result = await oidfSuite.waitForFinished(testInstance.id)
    return { ...result, logUrl: oidfSuite.logDetailUrl(testInstance.id) }
  }

  beforeAll(async () => {
    oidfDispatcher = new UndiciAgent({
      connect: { ca: readFileSync(OIDF_HTTPD_CA_PATH), checkServerIdentity: () => undefined },
    })

    app = express()

    // The suite follows the redirect_uri returned after a successful
    // direct_post(.jwt) and expects a 200. Serve it from the same HTTPS server.
    app.get(REDIRECT_PATH, (_req, res) => {
      res.sendStatus(200)
    })

    verifier = (await createAgentFromModules(
      {
        openid4vc: new OpenId4VcModule({
          app,
          verifier: { baseUrl: VERIFIER_BASE_URL },
        }),
        inMemory: new InMemoryWalletModule(),
      },
      '96213c3d7fc8d4d6754c7a0fd969598f'
    )) as unknown as typeof verifier

    openIdVerifier = await verifier.agent.openid4vc.verifier.createVerifier()

    // One EC P-256 key backs both the request-signing x509 certificate and the
    // TLS certificate, so the suite sees a consistent key/SAN when validating
    // the request signature (x509_hash) and when fetching the request object.
    const keyMaterial = generateConformanceKeyMaterial()
    const importedKey = await verifier.agent.kms.importKey({ privateJwk: keyMaterial.privateJwk })
    const authorityKey = Kms.PublicJwk.fromPublicJwk(importedKey.publicJwk)

    // The conformance suite rejects a self-signed leaf in the request object's
    // x5c header (ValidateRequestObjectSignatureAgainstX5cHeader). Issue the
    // verifier (leaf) certificate from a separate self-signed CA so the chain is
    // CA -> leaf. A distinct CA key signs the leaf; the leaf still carries the
    // shared verifier key so the TLS cert and request-signing key stay aligned.
    const caKeyMaterial = generateConformanceKeyMaterial()
    const importedCaKey = await verifier.agent.kms.importKey({ privateJwk: caKeyMaterial.privateJwk })
    const caKey = Kms.PublicJwk.fromPublicJwk(importedCaKey.publicJwk)

    caCertificate = await verifier.agent.x509.createCertificate({
      authorityKey: caKey,
      issuer: { commonName: 'Credo OID4VP Conformance CA', countryName: 'NL' },
      extensions: {
        basicConstraints: { ca: true, pathLenConstraint: 0, markAsCritical: true },
        keyUsage: { usages: [X509KeyUsage.KeyCertSign, X509KeyUsage.CrlSign] },
      },
    })

    verifierCertificate = await verifier.agent.x509.createCertificate({
      authorityKey: caKey,
      subjectPublicKey: authorityKey,
      issuer: { commonName: 'Credo OID4VP Conformance CA', countryName: 'NL' },
      subject: { commonName: 'Credo OID4VP Conformance', countryName: 'NL' },
      extensions: {
        subjectAlternativeName: { name: [{ type: 'dns', value: PUBLIC_HOSTNAME }] },
      },
    })
    verifier.agent.x509.config.addTrustedCertificate(caCertificate)

    // The conformance suite signs the presented mdoc with its own built-in mDL
    // document signer (a self-signed `certification.openid.net` cert that rotates
    // periodically), regardless of the `signing_jwk`/`jwks` we configure — unlike
    // sd-jwt, where it honours our key. For mdoc credential verification we
    // therefore trust the issuer chain embedded in the presented credential. The
    // suite is the legitimate issuer in this conformance context, and this avoids
    // pinning an expiring OIDF cert. All other verifications fall back to the
    // globally-trusted certs (our CA) by returning `undefined`.
    verifier.agent.x509.config.setTrustedCertificatesForVerification(
      (_agentContext, { verification, certificateChain }) => {
        if (verification.type === 'credential' && verification.credential instanceof Mdoc) {
          return certificateChain.map((certificate) => certificate.toString('pem'))
        }
        return undefined
      }
    )

    // Serve the verifier over real HTTPS. The suite reaches this on the host via
    // host.testcontainers.internal:9382.
    server = createServer(
      { key: keyMaterial.tlsKeyPem, cert: verifierCertificate.toString('pem') },
      app as unknown as Parameters<typeof createServer>[1]
    )
    await new Promise<void>((res) => server.listen(HOST_VERIFIER_PORT, '0.0.0.0', res))

    // Create one plan per variant and discover its modules. The suite self-issues
    // the presented credential with the verifier's leaf key, chained to the CA the
    // verifier trusts.
    for (const variant of VERIFIER_VARIANT_MATRIX) {
      const config = buildPlanConfig(variant, keyMaterial.privateJwk, [verifierCertificate, caCertificate])
      const planId = await oidfSuite.createPlan(VERIFIER_PLAN_NAME, variant, config)
      const modules = await oidfSuite.getPlanModuleNames(planId)
      createdPlans.push({ planId, variant, modules })
    }
  }, 300_000)

  afterAll(async () => {
    for (const { planId } of createdPlans) {
      if (!executedPlanIds.has(planId)) continue
      // Best-effort artifact capture; never fail teardown over a missing log.
      await oidfSuite
        .storePlanLog(planId, resolve(__dirname, `../../../../tmp/oidf/logs/${planId}.zip`))
        .catch(() => undefined)
    }

    if (server) await new Promise<void>((res) => server.close(() => res()))
    if (verifier) await verifier.agent.shutdown()
  })

  // One concurrent describe per variant. Modules run sequentially against the
  // variant's plan inside `beforeAll`; outcomes are asserted together so a
  // failure clearly lists every offending module.
  for (const variant of VERIFIER_VARIANT_MATRIX) {
    describe.concurrent(variantLabel(variant), () => {
      const outcomes = new Map<string, { result: string; status: string; logUrl: string } | { error: Error }>()
      let modules: string[] = []
      let bootstrapError: Error | undefined

      beforeAll(async () => {
        const planEntry = createdPlans.find((entry) => entry.variant === variant)
        if (!planEntry) {
          bootstrapError = new Error(`No plan created for variant ${variantLabel(variant)}`)
          return
        }
        modules = planEntry.modules

        for (const moduleName of modules) {
          if (skipReason(moduleName)) continue
          try {
            const result = await runModule(planEntry.planId, variant, moduleName)
            outcomes.set(moduleName, { result: result.result, status: result.status, logUrl: result.logUrl })
          } catch (error) {
            const wrapped = error instanceof Error ? error : new Error(String(error))
            outcomes.set(moduleName, { error: wrapped })
          }
        }
      }, 1_200_000)

      test('all verifier modules conform', () => {
        if (bootstrapError) throw bootstrapError
        if (modules.length === 0) throw new Error(`No modules discovered for ${variantLabel(variant)}`)

        const failures: string[] = []
        for (const moduleName of modules) {
          if (skipReason(moduleName)) continue
          const outcome = outcomes.get(moduleName)
          if (!outcome) {
            failures.push(`${moduleName}: did not run`)
          } else if ('error' in outcome) {
            failures.push(`${moduleName}: errored — ${outcome.error.message}`)
          } else if (!allowedResults(moduleName).includes(outcome.result)) {
            failures.push(
              `${moduleName}: result=${outcome.result} status=${outcome.status} (expected one of ${allowedResults(moduleName).join(', ')}) — ${outcome.logUrl}`
            )
          }
        }

        expect(failures, `Non-conformant modules:\n${failures.join('\n')}`).toEqual([])
      })
    })
  }
})

/**
 * Static EC P-256 encryption key the suite uses to build the encrypted
 * `direct_post.jwt` response for mdoc. Taken from the OpenWallet Foundation
 * EUDIPLO conformance setup. Only the suite (wallet) side uses this key.
 */
const MDOC_ENCRYPTION_JWK = {
  kty: 'EC',
  d: '7N8jd8HvUp3vHC7a-xitehRnYuyZLy3kqkxG7KmpfMY',
  use: 'enc',
  crv: 'P-256',
  kid: 'A541J5yUqazgE8WBFkIyeh2OtK-udqUR_OC0kB7l3oU',
  x: 'cwYyuS94hcOtcPlrMMtGtflCfbZUwz5Mf1Gfa2m0AM8',
  y: 'KB7sJkFQyB8jZHO9vmWS5LNECL4id3OJO9HX9ChNonA',
  alg: 'ECDH-ES',
} as const

/**
 * Builds the suite test configuration for a variant. The structure is the same
 * for sd-jwt and mdoc:
 *
 * - The suite (acting as the wallet) self-issues the credential it presents, so
 *   it needs a usable signing key. The same key is given as `credential.signing_jwk`
 *   and as the sig entry in `client.jwks.keys`; its `x5c` (leaf -> CA, not
 *   self-signed) is the issuer chain. The verifier trusts that CA, so the
 *   presented credential validates. Without the key in `client.jwks.keys` the
 *   suite falls back to its own built-in issuer, which the verifier does not trust.
 * - `client.dcql` is the query the suite presents against (same query the verifier
 *   sends in the authorization request).
 * - The enc key in `client.jwks.keys` plus `authorization_encrypted_response_*`
 *   are used for the encrypted `direct_post.jwt` response.
 * - HAIP requires the request object's x5c to chain to a trust anchor known to the
 *   suite out-of-band, supplied as `request_object_trust_anchor_pem` (the
 *   leaf-only x5c in the request header chains up to it).
 */
function buildPlanConfig(
  variant: VerifierVariant,
  issuerPrivateJwk: { kty: string; crv: string; x: string; y: string; d: string },
  certificateChain: X509Certificate[]
) {
  const x5c = certificateChain.map((certificate) => certificate.toString('base64'))

  const signingJwk = { ...issuerPrivateJwk, use: 'sig', alg: 'ES256', x5c }

  // The root CA is the last entry of the chain (leaf -> CA).
  const rootCertificate = certificateChain[certificateChain.length - 1]

  return {
    alias: `credo-${variant.credential_format}`,
    description: `credo-ts OID4VP verifier conformance — ${variantLabel(variant)}`,
    publish: 'everything',
    client: {
      request_object_trust_anchor_pem: rootCertificate.toString('pem'),
      dcql: dcqlForVariant(variant),
      jwks: { keys: [signingJwk, MDOC_ENCRYPTION_JWK] },
      authorization_encrypted_response_alg: 'ECDH-ES',
      authorization_encrypted_response_enc: 'A128GCM',
    },
    credential: {
      signing_jwk: signingJwk,
    },
  }
}
