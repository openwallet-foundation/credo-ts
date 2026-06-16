import { Buffer } from 'node:buffer'
import { MediaTypes, StatusType } from '@owf/token-status-list'
import nock from 'nock'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { KeyManagementApi, KnownJwaSignatureAlgorithms, P256PublicJwk, PublicJwk } from '../../kms'
import { TokenStatusListApi } from '../../token-status-list'
import { X509ModuleConfig } from '../../x509/X509ModuleConfig'
import { X509Service } from '../../x509/X509Service'
import { Mdoc } from '../Mdoc'
import { MdocDeviceResponse } from '../MdocDeviceResponse'
import { sprindFunkeTestVectorBase64Url, sprindFunkeX509TrustedCertificate } from './mdoc.fixtures'

const agentConfig = getAgentConfig('mdoc')
const agentContext = getAgentContext({ registerInstances: [[X509ModuleConfig, new X509ModuleConfig()]], agentConfig })

const getNextMonth = () => {
  const now = new Date()
  let nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  if (now.getMonth() === 11) {
    nextMonth = new Date(now.getFullYear() + 1, 0, 1)
  }
  return nextMonth
}

const kms = agentContext.resolve(KeyManagementApi)
const tokenStatusList = agentContext.resolve(TokenStatusListApi)

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

certificate.keyId = issuerKey.keyId

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
      validityInfo: {
        validUntil: nextDay,
      },
    })

    expect(mdoc.alg).toBe('ES256')
    expect(mdoc.docType).toBe('org.iso.18013.5.1.mDL')
    expect(mdoc.issuerSignedNamespaces).toStrictEqual({
      hello: {
        world: 'world',
        nicer: 'dicer',
      },
    })

    const { isValid } = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [certificate.toString('base64')] }],
    })
    expect(isValid).toBeTruthy()
  })

  test('can create and verify mdoc with status', async () => {
    const statusListUri = 'https://example.org/token-status-list/8'
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: {
        method: 'x5c',
        x5c: [certificate],
      },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: {
        statusListLength: 10,
        bitsPerStatus: 1,
      },
      statusListUri,
    })

    const { statusList: updatedStatusList } = await tokenStatusList.updateTokenStatusList({
      format: 'cwt',
      status: { status: StatusType.Valid, index: 1 },
      token: statusList as Uint8Array,
      signer: {
        method: 'x5c',
        x5c: [certificate],
      },
      alg: KnownJwaSignatureAlgorithms.ES256,
    })

    nock('https://example.org')
      .persist()
      .get('/token-status-list/8')
      .reply(200, Buffer.from(updatedStatusList), { 'Content-Type': MediaTypes.StatusListCwt })

    const currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1)
    const nextDay = new Date(currentDate)
    nextDay.setDate(currentDate.getDate() + 2)

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
      validityInfo: {
        validUntil: nextDay,
      },
      statusInfo: { index: 1, uri: statusListUri },
    })

    expect(mdoc.alg).toBe('ES256')
    expect(mdoc.docType).toBe('org.iso.18013.5.1.mDL')
    expect(mdoc.issuerSignedNamespaces).toStrictEqual({
      hello: {
        world: 'world',
        nicer: 'dicer',
      },
    })

    const x = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [certificate.toString('base64')], status: [certificate.toString('base64')] }],
    })

    expect(x.isValid).toBeTruthy()
  })

  test('can create and verify mdoc with legacy certificate format', async () => {
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
      validityInfo: {
        validUntil: nextDay,
      },
    })

    expect(mdoc.alg).toBe('ES256')
    expect(mdoc.docType).toBe('org.iso.18013.5.1.mDL')
    expect(mdoc.issuerSignedNamespaces).toStrictEqual({
      hello: {
        world: 'world',
        nicer: 'dicer',
      },
    })

    const { isValid } = await mdoc.verify(agentContext, {
      trustedCertificates: [certificate.toString('base64')],
    })
    expect(isValid).toBeTruthy()
  })

  test('embeds device key authorizations in MSO when provided', async () => {
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
        'org.iso.18013.5.1': {
          family_name: 'Doe',
          given_name: 'Jane',
        },
      },
      deviceKeyAuthorizations: {
        namespaces: ['org.iso.18013.5.1'],
        dataElements: {
          'org.iso.18013.5.1': ['family_name', 'given_name'],
        },
      },
      issuerCertificate: certificate,
      validityInfo: {
        validUntil: nextDay,
      },
    })

    const keyAuthorizations = mdoc.issuerSigned.issuerAuth.mobileSecurityObject.deviceKeyInfo.keyAuthorizations
    expect(keyAuthorizations?.namespaces).toEqual(['org.iso.18013.5.1'])
    expect(keyAuthorizations?.dataElements?.get('org.iso.18013.5.1')).toEqual(['family_name', 'given_name'])
  })

  test('omits device key authorizations when not provided', async () => {
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
        },
      },
      issuerCertificate: certificate,
      validityInfo: {
        validUntil: nextDay,
      },
    })

    expect(mdoc.issuerSigned.issuerAuth.mobileSecurityObject.deviceKeyInfo.keyAuthorizations).toBeUndefined()
  })

  test('embeds device-only key authorizations not present in issuance payload', async () => {
    const holderKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const issuerKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const nextDay = new Date()
    nextDay.setDate(nextDay.getDate() + 2)
    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(issuerKey.publicJwk),
      validity: { notBefore: new Date(), notAfter: nextDay },
      issuer: 'C=DE',
    })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { 'org.iso.18013.5.1': { family_name: 'Doe' } },
      deviceKeyAuthorizations: {
        namespaces: ['org.iso.18013.5.1', 'org.example.transaction'],
        dataElements: {
          'org.iso.18013.5.1': ['family_name'],
          'org.example.transaction': ['transaction_id'],
        },
      },
      issuerCertificate: certificate,
      validityInfo: { validUntil: nextDay },
    })

    const keyAuthorizations = mdoc.issuerSigned.issuerAuth.mobileSecurityObject.deviceKeyInfo.keyAuthorizations
    expect(keyAuthorizations?.namespaces).toEqual(['org.iso.18013.5.1', 'org.example.transaction'])
    expect(keyAuthorizations?.dataElements?.get('org.example.transaction')).toEqual(['transaction_id'])
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
      validityInfo: { validUntil: getNextMonth() },
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

    const verifyResult = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [certificate.toString('base64')] }],
    })
    expect(verifyResult).toEqual({
      error: "Country name (C) must be present in the issuer certificate's subject distinguished name",
      isValid: false,
    })

    const deviceResponse = await MdocDeviceResponse.createDeviceResponseWithPresentationDefinition(agentContext, {
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
    })

    const dr = MdocDeviceResponse.fromBase64Url(deviceResponse.encoded)
    await expect(
      dr.verify(agentContext, {
        sessionTranscriptOptions: {
          type: 'openId4VpDraft18',
          mdocGeneratedNonce: 'something',
          verifierGeneratedNonce: 'something-else',
          clientId: 'something',
          responseUri: 'something',
        },
        trustedCertificates: [{ issuance: [certificate.toString('pem')] }],
      })
    ).rejects.toThrow('Mdoc with doctype org.iso.18013.5.1.mDL is not valid')
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
