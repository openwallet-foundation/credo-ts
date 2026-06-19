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

  test('verify succeeds when status list is signed with the same certificate as the issuance certificate', async () => {
    const statusListUri = 'https://example.org/token-status-list/same-cert'
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: { method: 'x5c', x5c: [certificate] },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: { statusListLength: 10, bitsPerStatus: 1 },
      statusListUri,
    })

    nock('https://example.org')
      .persist()
      .get('/token-status-list/same-cert')
      .reply(200, Buffer.from(statusList as Uint8Array), { 'Content-Type': MediaTypes.StatusListCwt })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { hello: { world: 'world' } },
      issuerCertificate: certificate,
      validityInfo: { validUntil: nextDay },
      statusInfo: { index: 1, uri: statusListUri },
    })

    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [certificate.toString('base64')], status: [certificate.toString('base64')] }],
    })

    expect(result.isValid).toBe(true)
  })

  test('verify succeeds when status list is signed with a different certificate than the issuance certificate and dedicated status certificates are configured', async () => {
    const issuerKey2 = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const certificate2 = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(issuerKey2.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE',
    })
    certificate2.keyId = issuerKey2.keyId

    const statusListUri = 'https://example.org/token-status-list/different-cert'
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: { method: 'x5c', x5c: [certificate2] },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: { statusListLength: 10, bitsPerStatus: 1 },
      statusListUri,
    })

    nock('https://example.org')
      .persist()
      .get('/token-status-list/different-cert')
      .reply(200, Buffer.from(statusList as Uint8Array), { 'Content-Type': MediaTypes.StatusListCwt })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { hello: { world: 'world' } },
      issuerCertificate: certificate,
      validityInfo: { validUntil: nextDay },
      statusInfo: { index: 1, uri: statusListUri },
    })

    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [certificate.toString('base64')], status: [certificate2.toString('base64')] }],
    })

    expect(result.isValid).toBe(true)
  })

  test('verify fails when status list is signed with a different certificate than the issuance certificate and no dedicated status certificates are configured', async () => {
    const issuerKey2 = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const certificate2 = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(issuerKey2.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE',
    })
    certificate2.keyId = issuerKey2.keyId

    const statusListUri = 'https://example.org/token-status-list/different-cert-no-status'
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: { method: 'x5c', x5c: [certificate2] },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: { statusListLength: 10, bitsPerStatus: 1 },
      statusListUri,
    })

    nock('https://example.org')
      .persist()
      .get('/token-status-list/different-cert-no-status')
      .reply(200, Buffer.from(statusList as Uint8Array), { 'Content-Type': MediaTypes.StatusListCwt })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { hello: { world: 'world' } },
      issuerCertificate: certificate,
      validityInfo: { validUntil: nextDay },
      statusInfo: { index: 1, uri: statusListUri },
    })

    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [certificate.toString('base64'), certificate2.toString('base64')] }],
    })

    expect(result).toEqual({
      isValid: false,
      error:
        'Trusted status list chain does not match the trusted issuance chain, and no trusted status certificates were provided for the trusted issuance certificate',
    })
  })

  test('verify fails when an empty status certificates array is configured', async () => {
    const statusListUri = 'https://example.org/token-status-list/empty-status-config'
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: { method: 'x5c', x5c: [certificate] },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: { statusListLength: 10, bitsPerStatus: 1 },
      statusListUri,
    })

    nock('https://example.org')
      .persist()
      .get('/token-status-list/empty-status-config')
      .reply(200, Buffer.from(statusList as Uint8Array), { 'Content-Type': MediaTypes.StatusListCwt })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { hello: { world: 'world' } },
      issuerCertificate: certificate,
      validityInfo: { validUntil: nextDay },
      statusInfo: { index: 1, uri: statusListUri },
    })

    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [certificate.toString('base64')], status: [] }],
    })

    expect(result.isValid).toBe(false)
  })

  test('verify succeeds when status list is signed with the same certificate as the issuance certificate and no dedicated status certificates are configured', async () => {
    const statusListUri = 'https://example.org/token-status-list/same-cert-no-status-config'
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: { method: 'x5c', x5c: [certificate] },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: { statusListLength: 10, bitsPerStatus: 1 },
      statusListUri,
    })

    nock('https://example.org')
      .persist()
      .get('/token-status-list/same-cert-no-status-config')
      .reply(200, Buffer.from(statusList as Uint8Array), { 'Content-Type': MediaTypes.StatusListCwt })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { hello: { world: 'world' } },
      issuerCertificate: certificate,
      validityInfo: { validUntil: nextDay },
      statusInfo: { index: 1, uri: statusListUri },
    })

    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [certificate.toString('base64')] }],
    })

    expect(result.isValid).toBe(true)
  })

  test('verify succeeds when the trusted certificate is the root CA of the issuance chain', async () => {
    const rootKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const leafKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const rootCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(rootKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=Root',
      extensions: { basicConstraints: { ca: true } },
    })
    rootCertificate.keyId = rootKey.keyId

    const leafCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(rootKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(leafKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=Root',
      subject: 'C=DE,CN=Leaf',
    })
    leafCertificate.keyId = leafKey.keyId

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { hello: { world: 'world' } },
      issuerCertificate: leafCertificate,
      validityInfo: { validUntil: nextDay },
    })

    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [rootCertificate.toString('base64')] }],
    })

    expect(result.isValid).toBe(true)
  })

  test('verify succeeds when trusted root CA is shared between the issuance and status list chains', async () => {
    const rootKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const leafKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const rootCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(rootKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=Root',
      extensions: { basicConstraints: { ca: true } },
    })
    rootCertificate.keyId = rootKey.keyId

    const leafCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(rootKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(leafKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=Root',
      subject: 'C=DE,CN=Leaf',
    })
    leafCertificate.keyId = leafKey.keyId

    const statusListUri = 'https://example.org/token-status-list/root-same'
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: { method: 'x5c', x5c: [leafCertificate] },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: { statusListLength: 10, bitsPerStatus: 1 },
      statusListUri,
    })

    nock('https://example.org')
      .persist()
      .get('/token-status-list/root-same')
      .reply(200, Buffer.from(statusList as Uint8Array), { 'Content-Type': MediaTypes.StatusListCwt })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { hello: { world: 'world' } },
      issuerCertificate: leafCertificate,
      validityInfo: { validUntil: nextDay },
      statusInfo: { index: 1, uri: statusListUri },
    })

    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [{ issuance: [rootCertificate.toString('base64')] }],
    })

    expect(result.isValid).toBe(true)
  })

  test('verify succeeds when issuance and status list chains are anchored to different trusted root CAs', async () => {
    const issuanceRootKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const issuanceLeafKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const statusRootKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const statusLeafKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const issuanceRootCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(issuanceRootKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=IssuanceRoot',
      extensions: { basicConstraints: { ca: true } },
    })
    issuanceRootCertificate.keyId = issuanceRootKey.keyId

    const issuanceLeafCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(issuanceRootKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(issuanceLeafKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=IssuanceRoot',
      subject: 'C=DE,CN=IssuanceLeaf',
    })
    issuanceLeafCertificate.keyId = issuanceLeafKey.keyId

    const statusRootCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(statusRootKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=StatusRoot',
      extensions: { basicConstraints: { ca: true } },
    })
    statusRootCertificate.keyId = statusRootKey.keyId

    const statusLeafCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(statusRootKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(statusLeafKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=StatusRoot',
      subject: 'C=DE,CN=StatusLeaf',
    })
    statusLeafCertificate.keyId = statusLeafKey.keyId

    const statusListUri = 'https://example.org/token-status-list/root-different'
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: { method: 'x5c', x5c: [statusLeafCertificate] },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: { statusListLength: 10, bitsPerStatus: 1 },
      statusListUri,
    })

    nock('https://example.org')
      .persist()
      .get('/token-status-list/root-different')
      .reply(200, Buffer.from(statusList as Uint8Array), { 'Content-Type': MediaTypes.StatusListCwt })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { hello: { world: 'world' } },
      issuerCertificate: issuanceLeafCertificate,
      validityInfo: { validUntil: nextDay },
      statusInfo: { index: 1, uri: statusListUri },
    })

    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [
        {
          issuance: [issuanceRootCertificate.toString('base64')],
          status: [statusRootCertificate.toString('base64')],
        },
      ],
    })

    expect(result.isValid).toBe(true)
  })

  test('verify fails when status list chain is anchored to a different root CA than the issuance chain and no dedicated status certificates are configured', async () => {
    const issuanceRootKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const issuanceLeafKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const statusRootKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const statusLeafKey = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const issuanceRootCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(issuanceRootKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=IssuanceRoot',
      extensions: { basicConstraints: { ca: true } },
    })
    issuanceRootCertificate.keyId = issuanceRootKey.keyId

    const issuanceLeafCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(issuanceRootKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(issuanceLeafKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=IssuanceRoot',
      subject: 'C=DE,CN=IssuanceLeaf',
    })
    issuanceLeafCertificate.keyId = issuanceLeafKey.keyId

    const statusRootCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(statusRootKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=StatusRoot',
      extensions: { basicConstraints: { ca: true } },
    })
    statusRootCertificate.keyId = statusRootKey.keyId

    const statusLeafCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: PublicJwk.fromPublicJwk(statusRootKey.publicJwk),
      subjectPublicKey: PublicJwk.fromPublicJwk(statusLeafKey.publicJwk),
      validity: { notBefore: currentDate, notAfter: nextDay },
      issuer: 'C=DE,CN=StatusRoot',
      subject: 'C=DE,CN=StatusLeaf',
    })
    statusLeafCertificate.keyId = statusLeafKey.keyId

    const statusListUri = 'https://example.org/token-status-list/root-different-no-status'
    const { statusList } = await tokenStatusList.createTokenStatusList({
      format: 'cwt',
      signer: { method: 'x5c', x5c: [statusLeafCertificate] },
      alg: KnownJwaSignatureAlgorithms.ES256,
      statusList: { statusListLength: 10, bitsPerStatus: 1 },
      statusListUri,
    })

    nock('https://example.org')
      .persist()
      .get('/token-status-list/root-different-no-status')
      .reply(200, Buffer.from(statusList as Uint8Array), { 'Content-Type': MediaTypes.StatusListCwt })

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { hello: { world: 'world' } },
      issuerCertificate: issuanceLeafCertificate,
      validityInfo: { validUntil: nextDay },
      statusInfo: { index: 1, uri: statusListUri },
    })

    const result = await mdoc.verify(agentContext, {
      trustedCertificates: [
        {
          issuance: [issuanceRootCertificate.toString('base64'), statusRootCertificate.toString('base64')],
        },
      ],
    })

    expect(result).toEqual({
      isValid: false,
      error:
        'Trusted status list chain does not match the trusted issuance chain, and no trusted status certificates were provided for the trusted issuance certificate',
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
