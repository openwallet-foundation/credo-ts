import { getAgentConfig, getAgentContext } from '../../../tests/helpers'
import { simpleX509 } from '../../modules/sd-jwt-vc/__tests__/sdjwtvc.fixtures'
import { X509Certificate } from '../../modules/x509/X509Certificate'
import { X509ModuleConfig } from '../../modules/x509/X509ModuleConfig'
import { TrustedIssuerContext } from '../TrustedIssuerContext'

const x509ModuleConfig = new X509ModuleConfig()
const agentContext = getAgentContext({
  agentConfig: getAgentConfig('TrustedIssuerContext'),
  registerInstances: [[X509ModuleConfig, x509ModuleConfig]],
})

const issuerDid = 'did:key:z6MkpGR4gs4Rc3Zph4vj8wRnjnAxgAPSxcR8MAVKutWspQzc'
const didContext = {
  signer: { method: 'did', didUrl: `${issuerDid}#key-1` },
  verification: { type: 'test' },
} as const
const x509Context = {
  signer: {
    method: 'x509' as const,
    certificateChain: [X509Certificate.fromEncodedCertificate(simpleX509.trustedCertificate)],
  },
  verification: { type: 'test' },
}

describe('TrustedIssuerContext', () => {
  afterEach(() => {
    agentContext.config.setTrustedIssuersForVerification(undefined)
    x509ModuleConfig.setTrustedCertificates(undefined)
  })

  describe('getTrustedIssuersForVerification', () => {
    test('returns the trusted issuers of the callback', async () => {
      agentContext.config.setTrustedIssuersForVerification(async () => ({
        trustedIssuers: [{ method: 'did', issuance: issuerDid }],
      }))

      await expect(TrustedIssuerContext.getTrustedIssuersForVerification(agentContext, didContext)).resolves.toEqual({
        trustedIssuers: [{ method: 'did', issuance: issuerDid }],
      })
    })

    test('falls back to the trusted certificates of the x509 module for x509 signers', async () => {
      x509ModuleConfig.setTrustedCertificates([simpleX509.trustedCertificate])

      await expect(TrustedIssuerContext.getTrustedIssuersForVerification(agentContext, x509Context)).resolves.toEqual({
        trustedIssuers: [{ method: 'x509', issuance: [expect.any(String)] }],
      })
    })

    test('does not fall back to the trusted certificates of the x509 module when the callback returns a result', async () => {
      x509ModuleConfig.setTrustedCertificates([simpleX509.trustedCertificate])
      agentContext.config.setTrustedIssuersForVerification(async () => ({ trustedIssuers: [] }))

      await expect(TrustedIssuerContext.getTrustedIssuersForVerification(agentContext, x509Context)).resolves.toEqual({
        trustedIssuers: [],
      })
    })

    test('returns undefined for did signers when nothing is configured', async () => {
      x509ModuleConfig.setTrustedCertificates([simpleX509.trustedCertificate])

      await expect(
        TrustedIssuerContext.getTrustedIssuersForVerification(agentContext, didContext)
      ).resolves.toBeUndefined()
    })
  })
})
