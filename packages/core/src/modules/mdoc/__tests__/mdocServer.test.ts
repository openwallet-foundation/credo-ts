import type { AgentContext } from '../../../agent'

import { InMemoryWallet } from '../../../../../../tests/InMemoryWallet'
import { getAgentConfig, getAgentContext } from '../../../../tests'
import { KeyType } from '../../../crypto'
import { X509ModuleConfig, X509Service } from '../../x509'
import { Mdoc } from '../Mdoc'

import { MdocDeviceResponse } from '../MdocDeviceResponse'
import { sprindFunkeTestVectorBase64Url, sprindFunkeX509TrustedCertificate } from './mdoc.fixtures'

describe('mdoc service test', () => {
  let wallet: InMemoryWallet
  let agentContext: AgentContext

  beforeAll(async () => {
    const agentConfig = getAgentConfig('mdoc')
    wallet = new InMemoryWallet()
    agentContext = getAgentContext({ wallet, registerInstances: [[X509ModuleConfig, new X509ModuleConfig()]] })

    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    await wallet.createAndOpen(agentConfig.walletConfig!)
  })

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
    expect(deviceKey?.keyType).toBe(KeyType.P256)
    expect(deviceKey?.fingerprint).toBe('zDnaeq8nbXthvXNTYAzxdyvdWXgm5ev5xLEUtjZpfj1YtQ5g2')
  })

  test('can create and verify mdoc', async () => {
    const holderKey = await agentContext.wallet.createKey({
      keyType: KeyType.P256,
    })
    const issuerKey = await agentContext.wallet.createKey({
      keyType: KeyType.P256,
    })

    const currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1)
    const nextDay = new Date(currentDate)
    nextDay.setDate(currentDate.getDate() + 2)

    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey: issuerKey,
      validity: {
        notBefore: currentDate,
        notAfter: nextDay,
      },
      issuer: 'C=DE',
    })

    const issuerCertificate = certificate.toString('pem')

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: holderKey,
      namespaces: {
        hello: {
          world: 'world',
          nicer: 'dicer',
        },
      },
      issuerCertificate,
    })

    expect(mdoc.alg).toBe('ES256')
    expect(mdoc.docType).toBe('org.iso.18013.5.1.mDL')
    expect(mdoc.issuerSignedNamespaces).toStrictEqual({
      hello: {
        world: 'world',
        nicer: 'dicer',
      },
    })

    expect(() => mdoc.deviceSignedNamespaces).toBeNull()

    const { isValid } = await mdoc.verify(agentContext, {
      trustedCertificates: [certificate.toString('base64')],
    })
    expect(isValid).toBeTruthy()
  })

  test('throws error when mdoc is invalid (missing C= in cert)', async () => {
    const holderKey = await agentContext.wallet.createKey({
      keyType: KeyType.P256,
    })
    const issuerKey = await agentContext.wallet.createKey({
      keyType: KeyType.P256,
    })

    const currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1)
    const nextDay = new Date(currentDate)
    nextDay.setDate(currentDate.getDate() + 2)

    const certificate = await X509Service.createCertificate(agentContext, {
      authorityKey: issuerKey,
      validity: {
        notBefore: currentDate,
        notAfter: nextDay,
      },
      issuer: { commonName: 'hello' },
    })

    const issuerCertificate = certificate.toString('pem')

    const mdoc = await Mdoc.sign(agentContext, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: holderKey,
      namespaces: {
        hello: {
          world: 'world',
          nicer: 'dicer',
        },
      },
      issuerCertificate,
    })

    expect(mdoc.alg).toBe('ES256')
    expect(mdoc.docType).toBe('org.iso.18013.5.1.mDL')
    expect(mdoc.issuerSignedNamespaces).toStrictEqual({
      hello: {
        world: 'world',
        nicer: 'dicer',
      },
    })

    expect(() => mdoc.deviceSignedNamespaces).toThrow()

    const verifyResult = await mdoc.verify(agentContext, {
      trustedCertificates: [certificate.toString('base64')],
    })
    expect(verifyResult).toEqual({
      error: "Country name (C) must be present in the issuer certificate's subject distinguished name",
      isValid: false,
    })

    const { deviceResponseBase64Url } = await MdocDeviceResponse.createOpenId4VpDeviceResponse(agentContext, {
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
        mdocGeneratedNonce: 'something',
        verifierGeneratedNonce: 'something-else',
        clientId: 'something',
        responseUri: 'something',
      },
    })

    const deviceResponse = MdocDeviceResponse.fromBase64Url(deviceResponseBase64Url)
    expect(
      deviceResponse.verify(agentContext, {
        sessionTranscriptOptions: {
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

  test('can verify sprindFunkeTestVector Issuer Signed', async () => {
    const mdoc = Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url)
    const now = new Date('2024-08-12T14:50:42.124Z')
    const { isValid } = await mdoc.verify(agentContext, {
      trustedCertificates: [sprindFunkeX509TrustedCertificate],
      now,
    })
    expect(isValid).toBeTruthy()
  })
})
