import { CredoWebCrypto, X509ExtendedKeyUsage, X509KeyUsage } from '@credo-ts/core'
import { NodeInMemoryKeyManagementStorage, NodeKeyManagementService } from '../../../../../node/src'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { KeyManagementApi, KeyManagementModuleConfig, PublicJwk } from '../../kms'
import { CertificateSigningRequest } from '../CertificateSigningRequest'
import { X509Service } from '../X509Service'

/**
 *
 * Get the next month, accounting for a new year
 *
 */
const getNextMonth = () => {
  const now = new Date()
  let nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  if (now.getMonth() === 11) {
    nextMonth = new Date(now.getFullYear() + 1, 0, 1)
  }

  return nextMonth
}

/**
 *
 * Get the last month, accounting for a new year
 *
 */
const getLastMonth = () => {
  const now = new Date()
  let lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  if (now.getMonth() === 0) {
    lastMonth = new Date(now.getFullYear() - 1, 0, 1)
  }
  return lastMonth
}

const agentConfig = getAgentConfig('CertificateSigningRequest')
const agentContext = getAgentContext({
  agentConfig,
})

const kmsApi = new KeyManagementApi(
  new KeyManagementModuleConfig({
    backends: [new NodeKeyManagementService(new NodeInMemoryKeyManagementStorage())],
  }),
  agentContext
)
agentContext.dependencyManager.registerInstance(KeyManagementApi, kmsApi)

describe('CertificateSigningRequest', () => {
  describe('create', () => {
    it('should create a valid CSR with basic options', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'Test CSR', countryName: 'NL' },
        },
        new CredoWebCrypto(agentContext)
      )

      expect(csr).toBeDefined()
      expect(csr).toBeInstanceOf(CertificateSigningRequest)
      expect(csr.subject).toStrictEqual('CN=Test CSR, C=NL')

      // Verify the CSR signature
      const webCrypto = new CredoWebCrypto(agentContext)
      await expect(csr.verify(webCrypto)).resolves.toBeUndefined()
    })

    it('should create a CSR with extensions', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'Test CSR with Extensions', organizationalUnit: 'Engineering' },
          extensions: {
            subjectKeyIdentifier: {
              include: true,
            },
            keyUsage: {
              usages: [X509KeyUsage.DigitalSignature, X509KeyUsage.KeyEncipherment],
            },
            extendedKeyUsage: {
              usages: [X509ExtendedKeyUsage.ClientAuth],
            },
            subjectAlternativeName: {
              name: [
                { type: 'dns', value: 'example.com' },
                { type: 'url', value: 'https://example.com' },
              ],
            },
          },
        },
        new CredoWebCrypto(agentContext)
      )

      expect(csr).toBeDefined()
      expect(csr).toBeInstanceOf(CertificateSigningRequest)
      expect(csr.subject).toStrictEqual('CN=Test CSR with Extensions, OU=Engineering')
      expect(csr.sanDnsNames).toEqual(['example.com'])
      expect(csr.sanUriNames).toEqual(['https://example.com'])
      expect(csr.keyUsage).toEqual(
        expect.arrayContaining([X509KeyUsage.DigitalSignature, X509KeyUsage.KeyEncipherment])
      )
      expect(csr.extendedKeyUsage).toEqual(expect.arrayContaining([X509ExtendedKeyUsage.ClientAuth]))
      expect(csr.subjectKeyIdentifier).toBeDefined()

      const webCrypto = new CredoWebCrypto(agentContext)
      await expect(csr.verify(webCrypto)).resolves.toBeUndefined()
    })

    it('should create a CSR with string subject', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: 'CN=String Subject, O=Test Org',
        },
        new CredoWebCrypto(agentContext)
      )

      expect(csr).toBeDefined()
      expect(csr).toBeInstanceOf(CertificateSigningRequest)
      expect(csr.subject).toStrictEqual('CN=String Subject, O=Test Org')

      const webCrypto = new CredoWebCrypto(agentContext)
      await expect(csr.verify(webCrypto)).resolves.toBeUndefined()
    })
  })

  describe('parsing', () => {
    it('should parse an encoded CSR', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'Parse Test', countryName: 'US' },
          extensions: {
            subjectAlternativeName: {
              name: [{ type: 'dns', value: 'parse.test.com' }],
            },
          },
        },
        new CredoWebCrypto(agentContext)
      )

      const encodedCsr = csr.toString('pem')

      // Parse the encoded CSR
      const parsedCsr = CertificateSigningRequest.fromEncodedCertificateRequest(encodedCsr)

      expect(parsedCsr).toBeDefined()
      expect(parsedCsr).toBeInstanceOf(CertificateSigningRequest)
      expect(parsedCsr.subject).toStrictEqual('CN=Parse Test, C=US')
      expect(parsedCsr.sanDnsNames).toEqual(['parse.test.com'])
      expect(parsedCsr.publicJwk.toJson()).toMatchObject({
        kty: 'EC',
        crv: 'P-256',
      })
    })

    it('should parse a raw CSR', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'Raw Parse Test' },
        },
        new CredoWebCrypto(agentContext)
      )

      const rawCsr = csr.rawCertificateRequest

      // Parse the raw CSR
      const parsedCsr = CertificateSigningRequest.fromRawCertificateRequest(rawCsr)

      expect(parsedCsr).toBeDefined()
      expect(parsedCsr).toBeInstanceOf(CertificateSigningRequest)
      expect(parsedCsr.subject).toStrictEqual('CN=Raw Parse Test')
    })
  })

  describe('field extraction', () => {
    it('should extract public key as JWK', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const subjectPublicJwk = PublicJwk.fromPublicJwk(subjectKey.publicJwk)

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: subjectPublicJwk,
          subject: { commonName: 'JWK Test' },
        },
        new CredoWebCrypto(agentContext)
      )

      expect(csr.publicJwk).toBeDefined()
      expect(csr.publicJwk.toJson()).toMatchObject({
        kty: 'EC',
        crv: 'P-256',
        x: expect.any(String),
        y: expect.any(String),
      })
    })

    it('should extract subject name fields', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: {
            commonName: 'Subject Test',
            countryName: 'US',
            stateOrProvinceName: 'California',
            organizationalUnit: 'Engineering',
          },
        },
        new CredoWebCrypto(agentContext)
      )

      expect(csr.subject).toContain('CN=Subject Test')
      expect(csr.subject).toContain('C=US')
      expect(csr.subject).toContain('ST=California')
      expect(csr.subject).toContain('OU=Engineering')
      expect(csr.subjectName).toBe(csr.subject)
      expect(csr.getSubjectNameField('CN')).toContain('Subject Test')
    })

    it('should extract subject alternative names', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'SAN Test' },
          extensions: {
            subjectAlternativeName: {
              name: [
                { type: 'dns', value: 'example1.com' },
                { type: 'dns', value: 'example2.com' },
                { type: 'url', value: 'https://example.com' },
                { type: 'url', value: 'https://example.org' },
              ],
            },
          },
        },
        new CredoWebCrypto(agentContext)
      )

      expect(csr.subjectAlternativeNames).toHaveLength(4)
      expect(csr.sanDnsNames).toEqual(['example1.com', 'example2.com'])
      expect(csr.sanUriNames).toEqual(['https://example.com', 'https://example.org'])
    })

    it('should extract key usage extensions', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'Key Usage Test' },
          extensions: {
            keyUsage: {
              usages: [X509KeyUsage.DigitalSignature, X509KeyUsage.KeyEncipherment, X509KeyUsage.DataEncipherment],
            },
            extendedKeyUsage: {
              usages: [X509ExtendedKeyUsage.ClientAuth, X509ExtendedKeyUsage.ServerAuth],
            },
          },
        },
        new CredoWebCrypto(agentContext)
      )

      expect(csr.keyUsage).toEqual(
        expect.arrayContaining([
          X509KeyUsage.DigitalSignature,
          X509KeyUsage.KeyEncipherment,
          X509KeyUsage.DataEncipherment,
        ])
      )
      expect(csr.extendedKeyUsage).toEqual(
        expect.arrayContaining([X509ExtendedKeyUsage.ClientAuth, X509ExtendedKeyUsage.ServerAuth])
      )
    })

    it('should extract subject key identifier', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'SKI Test' },
          extensions: {
            subjectKeyIdentifier: {
              include: true,
            },
          },
        },
        new CredoWebCrypto(agentContext)
      )

      expect(csr.subjectKeyIdentifier).toBeDefined()
      expect(csr.subjectKeyIdentifier).toMatch(/^[0-9a-f]+$/i)
    })
  })

  describe('integration with X509Service', () => {
    it('should create a certificate from a CSR', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const authorityKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const subjectPublicJwk = PublicJwk.fromPublicJwk(subjectKey.publicJwk)

      // Create CSR
      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: subjectPublicJwk,
          subject: { commonName: 'CSR Subject', countryName: 'US', organizationalUnit: 'IT' },
          extensions: {
            subjectKeyIdentifier: {
              include: true,
            },
            keyUsage: {
              usages: [X509KeyUsage.DigitalSignature],
            },
            extendedKeyUsage: {
              usages: [X509ExtendedKeyUsage.ClientAuth],
            },
            subjectAlternativeName: {
              name: [{ type: 'dns', value: 'csr.example.com' }],
            },
          },
        },
        new CredoWebCrypto(agentContext)
      )

      // Verify CSR is valid
      const webCrypto = new CredoWebCrypto(agentContext)
      await expect(csr.verify(webCrypto)).resolves.toBeUndefined()

      // Create certificate based on the CSR
      const certificate = await X509Service.createCertificate(agentContext, {
        serialNumber: '123456',
        authorityKey: PublicJwk.fromPublicJwk(authorityKey.publicJwk),
        subjectPublicKey: subjectPublicJwk,
        issuer: { commonName: 'Certificate Authority', countryName: 'US' },
        subject: csr.subject,
        validity: {
          notBefore: getLastMonth(),
          notAfter: getNextMonth(),
        },
        extensions: {
          subjectKeyIdentifier: {
            include: csr.subjectKeyIdentifier !== undefined,
          },
          authorityKeyIdentifier: {
            include: true,
          },
          keyUsage: {
            usages: csr.keyUsage,
          },
          extendedKeyUsage:
            csr.extendedKeyUsage.length > 0
              ? {
                  usages: csr.extendedKeyUsage,
                }
              : undefined,
          subjectAlternativeName: {
            name: [{ type: 'dns', value: 'csr.example.com' }],
          },
        },
      })

      expect(certificate).toBeDefined()
      expect(certificate.subject).toStrictEqual(csr.subject)
      expect(certificate.issuer).toStrictEqual('CN=Certificate Authority, C=US')
      expect(certificate.sanDnsNames).toEqual(['csr.example.com'])
      expect(certificate.keyUsage).toContain(X509KeyUsage.DigitalSignature)
      expect(certificate.extendedKeyUsage).toContain(X509ExtendedKeyUsage.ClientAuth)
    })

    it('should work with X509Service.createCertificateSigningRequest', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await X509Service.createCertificateSigningRequest(agentContext, {
        subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
        subject: { commonName: 'Service Test' },
      })

      expect(csr).toBeInstanceOf(CertificateSigningRequest)
      expect(csr.subject).toStrictEqual('CN=Service Test')
    })
  })

  describe('data export', () => {
    it('should export CSR data', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'Data Export Test', countryName: 'NL' },
        },
        new CredoWebCrypto(agentContext)
      )

      const data = csr.data

      expect(data).toMatchObject({
        subjectName: 'CN=Data Export Test, C=NL',
        subject: 'CN=Data Export Test, C=NL',
        pem: expect.stringContaining('BEGIN CERTIFICATE REQUEST'),
      })
    })

    it('should export to different formats', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'Format Test' },
        },
        new CredoWebCrypto(agentContext)
      )

      const pem = csr.toString('pem')
      const base64 = csr.toString('base64')
      const hex = csr.toString('hex')

      expect(pem).toContain('BEGIN CERTIFICATE REQUEST')
      expect(pem).toContain('END CERTIFICATE REQUEST')
      expect(base64).toMatch(/^[A-Za-z0-9+/=]+$/)
      expect(hex).toMatch(/^[0-9a-f]+$/)
    })
  })

  describe('comparison', () => {
    it('should correctly compare CSRs', async () => {
      const subjectKey = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr1 = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey.publicJwk),
          subject: { commonName: 'Comparison Test' },
        },
        new CredoWebCrypto(agentContext)
      )

      // Parse the same CSR
      const csr2 = CertificateSigningRequest.fromEncodedCertificateRequest(csr1.toString('pem'))

      expect(csr1.equal(csr2)).toBe(true)
    })

    it('should detect different CSRs', async () => {
      const subjectKey1 = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      const subjectKey2 = await kmsApi.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const csr1 = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey1.publicJwk),
          subject: { commonName: 'CSR 1' },
        },
        new CredoWebCrypto(agentContext)
      )

      const csr2 = await CertificateSigningRequest.create(
        {
          subjectPublicKey: PublicJwk.fromPublicJwk(subjectKey2.publicJwk),
          subject: { commonName: 'CSR 2' },
        },
        new CredoWebCrypto(agentContext)
      )

      expect(csr1.equal(csr2)).toBe(false)
    })
  })
})
