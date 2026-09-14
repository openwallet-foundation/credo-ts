import { Buffer } from 'node:buffer'
import { DistributionPoint, DistributionPointName, GeneralName, Reason } from '@peculiar/asn1-x509'
import * as x509 from '@peculiar/x509'
import type { Scope } from 'nock'
import nock from 'nock'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import type { AgentContext } from '../../../agent/context'
import { CredoWebCrypto, CredoWebCryptoKey, publicJwkToCryptoKeyAlgorithm } from '../../../crypto/webcrypto'
import { CacheModule, InMemoryLruCache } from '../../cache'
import { KeyManagementApi, PublicJwk } from '../../kms'
import { X509Module } from '../X509Module'
import type { X509RevocationCheckOptions } from '../X509ValidationOptions'

export interface CrlTestAgent {
  agent: Agent
  agentContext: AgentContext
  kmsApi: KeyManagementApi
  /** The in-memory cache used by the agent. Tests can `clear()` it between cases. */
  cache: InMemoryLruCache
}

/**
 * Create and initialize a real {@link Agent} wired for CRL revocation tests.
 *
 * Uses an in-memory wallet (KMS + storage) like the rest of the repo's tests. The default cache
 * module is overridden with an {@link InMemoryLruCache} so tests can reset it between cases, and
 * the X509 module is configured with the provided revocation settings.
 *
 * HTTP requests (CRL fetches) are intercepted with `nock` (see {@link interceptCrl}); the agent
 * uses its real `fetch`.
 *
 * Remember to `await agent.shutdown()` in `afterAll`.
 *
 * @param options.revocationCheck optional revocation configuration for the X509 module
 * @param options.cache optional cache instance, e.g. to share a cache between two agents
 */
export async function setupCrlAgent(options?: {
  revocationCheck?: X509RevocationCheckOptions
  cache?: InMemoryLruCache
}): Promise<CrlTestAgent> {
  const cache = options?.cache ?? new InMemoryLruCache({ limit: 100 })

  const { config, modules, dependencies } = getAgentOptions(
    'X509 CRL',
    undefined,
    {},
    {
      x509: new X509Module({ revocationCheck: options?.revocationCheck }),
      cache: new CacheModule({ cache }),
    }
  )

  const agent = new Agent({ config, modules, dependencies })

  await agent.initialize()

  return { agent, agentContext: agent.context, kmsApi: agent.kms, cache }
}

function interceptCrl(url: string, times?: number) {
  const { origin, pathname, search } = new URL(url)
  const interceptor = nock(origin).get(`${pathname}${search}`)
  return times ? interceptor.times(times) : interceptor
}

/**
 * Intercept a CRL URL with `nock` and reply with the given DER bytes.
 *
 * @param options.status HTTP status to reply with (default 200)
 * @param options.times how many times the interceptor should respond (default once)
 */
export function mockCrl(url: string, bytes: Uint8Array, options?: { status?: number; times?: number }): Scope {
  return interceptCrl(url, options?.times).reply(options?.status ?? 200, Buffer.from(bytes))
}

/** Intercept a CRL URL and reply with an (empty-body) HTTP error status. */
export function mockCrlHttpError(url: string, status: number): Scope {
  return interceptCrl(url).reply(status)
}

/** Intercept a CRL URL and fail with a network error. */
export function mockCrlNetworkError(url: string, options?: { times?: number }): Scope {
  return interceptCrl(url, options?.times).replyWithError('network error')
}

/** Create a fresh P-256 key and return its {@link PublicJwk}. */
export async function createP256Key(kmsApi: KeyManagementApi): Promise<PublicJwk> {
  return PublicJwk.fromPublicJwk((await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })).publicJwk)
}

/**
 * Build a leaf certificate (signed by `issuerKey`) carrying a single CRL Distribution Points
 * extension with multiple **partitioned** distribution points. The `createCertificate` helper only
 * writes a single distribution point, so this constructs the cert directly via `@peculiar/x509` for
 * tests that need reason-partitioned CRLs across several DPs.
 *
 * Returns the DER bytes of the certificate (parse with `X509Certificate.fromRawCertificate`).
 */
export async function generateLeafWithPartitionedDistributionPoints(
  agentContext: AgentContext,
  options: {
    issuerKey: PublicJwk
    issuerName: string
    subjectPublicKey: PublicJwk
    subjectCommonName: string
    serialNumber: string
    notBefore: Date
    notAfter: Date
    /** Each entry becomes a partitioned distribution point covering the single given reason (a ReasonFlags bit index). */
    distributionPoints: Array<{ url: string; reason: number }>
  }
): Promise<Uint8Array> {
  const webCrypto = new CredoWebCrypto(agentContext)

  const signingKey = new CredoWebCryptoKey(
    options.issuerKey,
    publicJwkToCryptoKeyAlgorithm(options.issuerKey),
    false,
    'private',
    ['sign']
  )
  const publicKey = new CredoWebCryptoKey(
    options.subjectPublicKey,
    publicJwkToCryptoKeyAlgorithm(options.issuerKey),
    true,
    'public',
    ['verify']
  )

  const distributionPoints = options.distributionPoints.map(({ url, reason }) => {
    const dp = new DistributionPoint({
      distributionPoint: new DistributionPointName({
        fullName: [new GeneralName({ uniformResourceIdentifier: url })],
      }),
    })
    const reasons = new Reason()
    reasons.fromNumber(1 << reason)
    dp.reasons = reasons
    return dp
  })

  const certificate = await x509.X509CertificateGenerator.create(
    {
      signingKey,
      publicKey,
      issuer: options.issuerName,
      subject: `CN=${options.subjectCommonName}`,
      notBefore: options.notBefore,
      notAfter: options.notAfter,
      serialNumber: options.serialNumber,
      extensions: [new x509.CRLDistributionPointsExtension(distributionPoints)],
    },
    webCrypto
  )

  return new Uint8Array(certificate.rawData)
}
