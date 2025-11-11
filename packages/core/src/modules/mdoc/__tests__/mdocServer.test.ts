import { getAgentConfig, getAgentContext } from '../../../../tests'
import { KeyManagementApi, P256PublicJwk, PublicJwk } from '../../kms'
import { X509ModuleConfig, X509Service } from '../../x509'
import { Mdoc } from '../Mdoc'
import { MdocDeviceResponse } from '../MdocDeviceResponse'
import { sprindFunkeTestVectorBase64Url, sprindFunkeX509TrustedCertificate } from './mdoc.fixtures'

const agentConfig = getAgentConfig('mdoc')
const agentContext = getAgentContext({ registerInstances: [[X509ModuleConfig, new X509ModuleConfig()]], agentConfig })
const kms = agentContext.resolve(KeyManagementApi)
describe('mdoc service test', () => {
  test('can get issuer-auth protected-header alg', async () => {
    const mdoc = Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url)
    expect(mdoc.alg).toBe('ES256')
  })

  test('can get doctype', async () => {
    const mdoc = Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url)
    expect(mdoc.docType).toBe('eu.europa.ec.eudi.pid.1')
  })

  test('can get device key', async () => {
    const mdoc = Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url)
    const deviceKey = mdoc.deviceKey
    expect(deviceKey?.is(P256PublicJwk)).toBe(true)
    expect(deviceKey?.fingerprint).toBe('zDnaeq8nbXthvXNTYAzxdyvdWXgm5ev5xLEUtjZpfj1YtQ5g2')
  })

  test('can create and verify mdoc', async () => {
    const holderKey = await kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    const issuerKey = await kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })

    const currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1)
    const nextDay = new Date(currentDate)
    nextDay.setDate(currentDate.getDate() + 2)

    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(issuerKey.publicJwk),
      validity: {
        notBefore: currentDate,
        notAfter: nextDay,
      },
      issuer: 'C=DE',
    })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: {
        hello: {
          world: 'world',
          nicer: 'dicer',
        },
      },
      issuerCertificate: certificate,
    })

    expect(mdoc.alg).toBe('ES256')
    expect(mdoc.docType).toBe('org.iso.18013.5.1.mDL')
    expect(mdoc.issuerSignedNamespaces).toStrictEqual({
      hello: {
        world: 'world',
        nicer: 'dicer',
      },
    })

    expect(mdoc.deviceSignedNamespaces).toBeNull()

    const { isValid } = await mdoc.verify(agentContext, {
      trustedCertificates: [certificate.toString('base64')],
    })
    expect(isValid).toBeTruthy()
  })

  test('throws error when mdoc is invalid (missing C= in cert)', async () => {
    const holderKey = await kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })
    const issuerKey = await kms.createKey({
      type: {
        kty: 'EC',
        crv: 'P-256',
      },
    })

    const currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1)
    const nextDay = new Date(currentDate)
    nextDay.setDate(currentDate.getDate() + 2)

    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(issuerKey.publicJwk),
      validity: {
        notBefore: currentDate,
        notAfter: nextDay,
      },
      issuer: { commonName: 'hello' },
    })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: {
        hello: {
          world: 'world',
          nicer: 'dicer',
        },
      },
      issuerCertificate: certificate,
    })

    expect(mdoc.alg).toBe('ES256')
    expect(mdoc.docType).toBe('org.iso.18013.5.1.mDL')
    expect(mdoc.issuerSignedNamespaces).toStrictEqual({
      hello: {
        world: 'world',
        nicer: 'dicer',
      },
    })

    expect(mdoc.deviceSignedNamespaces).toBeNull()

    const verifyResult = await mdoc.verify(agentContext, {
      trustedCertificates: [certificate.toString('base64')],
    })
    expect(verifyResult).toEqual({
      error: "Country name (C) must be present in the issuer certificate's subject distinguished name",
      isValid: false,
    })

    const { deviceResponseBase64Url } = await MdocDeviceResponse.createPresentationDefinitionDeviceResponse(
      agentContext,
      {
        mdocs: [mdoc],
        presentationDefinition: {
          id: 'something',
          input_descriptors: [
            {
              id: 'org.iso.18013.5.1.mDL',
              format: {
                mso_mdoc: {
                  alg: ['EdDSA', 'ES256'],
                },
              },
              constraints: {
                limit_disclosure: 'required',
                fields: [
                  {
                    path: ["$['hello']['world']"],
                    intent_to_retain: false,
                  },
                ],
              },
            },
          ],
        },
        sessionTranscriptOptions: {
          type: 'openId4VpDraft18',
          mdocGeneratedNonce: 'something',
          verifierGeneratedNonce: 'something-else',
          clientId: 'something',
          responseUri: 'something',
        },
      }
    )

    const deviceResponse = MdocDeviceResponse.fromBase64Url(deviceResponseBase64Url)
    await expect(
      deviceResponse.verify(agentContext, {
        sessionTranscriptOptions: {
          type: 'openId4VpDraft18',
          mdocGeneratedNonce: 'something',
          verifierGeneratedNonce: 'something-else',
          clientId: 'something',
          responseUri: 'something',
        },
        trustedCertificates: [certificate.toString('pem')],
      })
    ).rejects.toThrow(
      "Mdoc at index 0 is not valid. Country name (C) must be present in the issuer certificate's subject distinguished name"
    )
  })

  test('can decode claims from namespaces', async () => {
    const mdoc = Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url)
    const namespaces = mdoc.issuerSignedNamespaces
    expect(Object.entries(namespaces)).toHaveLength(1)

    expect(namespaces).toBeDefined()
    const eudiPidNamespace = namespaces['eu.europa.ec.eudi.pid.1']
    expect(eudiPidNamespace).toBeDefined()
    expect(eudiPidNamespace).toStrictEqual({
      resident_country: 'DE',
      age_over_12: true,
      family_name_birth: 'GABLER',
      given_name: 'ERIKA',
      age_birth_year: 1984,
      age_over_18: true,
      age_over_21: true,
      resident_city: 'KÖLN',
      family_name: 'MUSTERMANN',
      birth_place: 'BERLIN',
      expiry_date: new Date('2024-08-26T14:49:42.124Z'),
      issuing_country: 'DE',
      age_over_65: false,
      issuance_date: new Date('2024-08-12T14:49:42.124Z'),
      resident_street: 'HEIDESTRASSE 17',
      age_over_16: true,
      resident_postal_code: '51147',
      birth_date: '1984-01-26',
      issuing_authority: 'DE',
      age_over_14: true,
      age_in_years: 40,
      nationality: new Map([
        ['value', 'DE'],
        ['countryName', 'Germany'],
      ]),
    })
  })

  // FIXME: test is skipped due to a breaking change in mdoc library that prevents us to
  // specify a custom verification date (it does not take the parameter into account)
  // This is needed in this test because the certificate is only valid from 2024-08-12 and 2024-08-24
  test.skip('can verify sprindFunkeTestVector Issuer Signed', async () => {
    const mdoc = Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url)
    const now = new Date('2024-08-12T14:50:42.124Z')
    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [sprindFunkeX509TrustedCertificate],
      now,
    })

    // FIXME: now should be passed to the certificate validation
    // method as well, so that we can check it at a previous point in
    // time: https://github.com/animo/mdoc/issues/83
    expect(result).toEqual({
      isValid: false,
      error:
        "Certificate: 'C=DE, O=Bundesdruckerei GmbH, OU=I, CN=SPRIND Funke EUDI Wallet Prototype Issuer' used after it is allowed",
    })
  })
})
