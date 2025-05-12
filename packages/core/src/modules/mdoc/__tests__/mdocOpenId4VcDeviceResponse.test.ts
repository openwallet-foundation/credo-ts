import type { DifPresentationExchangeDefinition } from '../../dif-presentation-exchange'

import { cborEncode, parseDeviceResponse } from '@animo-id/mdoc'

import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { TypedArrayEncoder } from '../../../utils'
import { PublicJwk } from '../../kms'
import { X509Certificate } from '../../x509'
import { Mdoc } from '../Mdoc'
import { MdocDeviceResponse } from '../MdocDeviceResponse'

const DEVICE_JWK_PUBLIC_P256 = {
  kty: 'EC',
  x: 'iBh5ynojixm_D0wfjADpouGbp6b3Pq6SuFHU3htQhVk',
  y: 'oxS1OAORJ7XNUHNfVFGeM8E0RQVFxWA62fJj-sxW03c',
  crv: 'P-256',
  use: undefined,
} as const

const DEVICE_JWK_PRIVATE_P256 = {
  ...DEVICE_JWK_PUBLIC_P256,
  d: 'eRpAZr3eV5xMMnPG3kWjg90Y-bBff9LqmlQuk49HUtA',
} as const

const ISSUER_PRIVATE_KEY_JWK_P256 = {
  kty: 'EC',
  kid: '1234',
  x: 'iTwtg0eQbcbNabf2Nq9L_VM_lhhPCq2s0Qgw2kRx29s',
  y: 'YKwXDRz8U0-uLZ3NSI93R_35eNkl6jHp6Qg8OCup7VM',
  crv: 'P-256',
  d: 'o6PrzBm1dCfSwqJHW6DVqmJOCQSIAosrCPfbFJDMNp4',
} as const

const ISSUER_CERTIFICATE_P256 = `-----BEGIN CERTIFICATE-----
MIICKjCCAdCgAwIBAgIUV8bM0wi95D7KN0TyqHE42ru4hOgwCgYIKoZIzj0EAwIw
UzELMAkGA1UEBhMCVVMxETAPBgNVBAgMCE5ldyBZb3JrMQ8wDQYDVQQHDAZBbGJh
bnkxDzANBgNVBAoMBk5ZIERNVjEPMA0GA1UECwwGTlkgRE1WMB4XDTIzMDkxNDE0
NTUxOFoXDTMzMDkxMTE0NTUxOFowUzELMAkGA1UEBhMCVVMxETAPBgNVBAgMCE5l
dyBZb3JrMQ8wDQYDVQQHDAZBbGJhbnkxDzANBgNVBAoMBk5ZIERNVjEPMA0GA1UE
CwwGTlkgRE1WMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEiTwtg0eQbcbNabf2
Nq9L/VM/lhhPCq2s0Qgw2kRx29tgrBcNHPxTT64tnc1Ij3dH/fl42SXqMenpCDw4
K6ntU6OBgTB/MB0GA1UdDgQWBBSrbS4DuR1JIkAzj7zK3v2TM+r2xzAfBgNVHSME
GDAWgBSrbS4DuR1JIkAzj7zK3v2TM+r2xzAPBgNVHRMBAf8EBTADAQH/MCwGCWCG
SAGG+EIBDQQfFh1PcGVuU1NMIEdlbmVyYXRlZCBDZXJ0aWZpY2F0ZTAKBggqhkjO
PQQDAgNIADBFAiAJ/Qyrl7A+ePZOdNfc7ohmjEdqCvxaos6//gfTvncuqQIhANo4
q8mKCA9J8k/+zh//yKbN1bLAtdqPx7dnrDqV3Lg+
-----END CERTIFICATE-----`

const PRESENTATION_DEFINITION_1 = {
  id: 'mdl-test-all-data',
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
            path: ["$['org.iso.18013.5.1']['family_name']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['given_name']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['birth_date']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['issue_date']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['expiry_date']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['issuing_country']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['issuing_authority']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['issuing_jurisdiction']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['document_number']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['portrait']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['driving_privileges']"],
            intent_to_retain: false,
          },
          {
            path: ["$['org.iso.18013.5.1']['un_distinguishing_sign']"],
            intent_to_retain: false,
          },
        ],
      },
    },
  ],
} satisfies DifPresentationExchangeDefinition

describe('mdoc device-response openid4vp test', () => {
  let deviceResponse: string
  let mdoc: Mdoc
  let parsedDocument: Mdoc

  const verifierGeneratedNonce = 'abcdefg'
  const mdocGeneratedNonce = '123456'
  const clientId = 'Cq1anPb8vZU5j5C0d7hcsbuJLBpIawUJIDQRi2Ebwb4'
  const responseUri = 'http://localhost:4000/api/presentation_request/dc8999df-d6ea-4c84-9985-37a8b81a82ec/callback'

  let agent: Agent

  afterEach(async () => {
    await agent?.shutdown()
  })

  describe('P256', () => {
    beforeEach(async () => {
      agent = new Agent(getAgentOptions('mdoc-test-agent', {}))
      await agent.initialize()

      const importedDeviceKey = await agent.kms.importKey({
        privateJwk: DEVICE_JWK_PRIVATE_P256,
      })
      const deviceKeyPublicJwk = PublicJwk.fromPublicJwk(importedDeviceKey.publicJwk)

      const importedIssuerKey = await agent.kms.importKey({
        privateJwk: ISSUER_PRIVATE_KEY_JWK_P256,
      })
      const issuerCertificate = X509Certificate.fromEncodedCertificate(ISSUER_CERTIFICATE_P256)
      issuerCertificate.keyId = importedIssuerKey.keyId

      mdoc = await Mdoc.sign(agent.context, {
        docType: 'org.iso.18013.5.1.mDL',
        validityInfo: {
          signed: new Date('2023-10-24'),
          validUntil: new Date('2050-10-24'),
        },
        holderKey: deviceKeyPublicJwk,
        issuerCertificate,
        namespaces: {
          'org.iso.18013.5.1': {
            family_name: 'Jones',
            given_name: 'Ava',
            birth_date: '2007-03-25',
            issue_date: '2023-09-01',
            expiry_date: '2028-09-31',
            issuing_country: 'US',
            issuing_authority: 'NY DMV',
            document_number: '01-856-5050',
            portrait: 'bstr',
            driving_privileges: [
              {
                vehicle_category_code: 'C',
                issue_date: '2023-09-01',
                expiry_date: '2028-09-31',
              },
            ],
            un_distinguishing_sign: 'tbd-us.ny.dmv',

            sex: 'F',
            height: '5\' 8"',
            weight: '120lb',
            eye_colour: 'brown',
            hair_colour: 'brown',
            resident_addres: '123 Street Rd',
            resident_city: 'Brooklyn',
            resident_state: 'NY',
            resident_postal_code: '19001',
            resident_country: 'US',
            issuing_jurisdiction: 'New York',
          },
        },
      })

      //  This is the Device side
      {
        const result = await MdocDeviceResponse.createPresentationDefinitionDeviceResponse(agent.context, {
          mdocs: [mdoc],
          presentationDefinition: PRESENTATION_DEFINITION_1,
          sessionTranscriptOptions: {
            type: 'openId4Vp',
            clientId,
            responseUri,
            verifierGeneratedNonce,
            mdocGeneratedNonce,
          },
          deviceNameSpaces: {
            'com.foobar-device': { test: 1234 },
          },
        })
        deviceResponse = result.deviceResponseBase64Url

        const parsed = parseDeviceResponse(TypedArrayEncoder.fromBase64(deviceResponse))
        expect(parsed.documents).toHaveLength(1)

        const prepared = parsed.documents[0].prepare()
        const docType = prepared.get('docType') as string
        const issuerSigned = cborEncode(prepared.get('issuerSigned'))
        const deviceSigned = cborEncode(prepared.get('deviceSigned'))
        parsedDocument = Mdoc.fromDeviceSignedDocument(
          TypedArrayEncoder.toBase64URL(issuerSigned),
          TypedArrayEncoder.toBase64URL(deviceSigned),
          docType
        )
      }
    })

    it('should be verifiable', async () => {
      const mdocDeviceResponse = MdocDeviceResponse.fromBase64Url(deviceResponse)
      const res = await mdocDeviceResponse.verify(agent.context, {
        trustedCertificates: [ISSUER_CERTIFICATE_P256],
        sessionTranscriptOptions: {
          type: 'openId4Vp',
          clientId,
          responseUri,
          verifierGeneratedNonce,
          mdocGeneratedNonce,
        },
      })
      expect(res).toHaveLength(1)
    })

    describe('should not be verifiable', () => {
      const testCases = ['clientId', 'responseUri', 'verifierGeneratedNonce', 'mdocGeneratedNonce']

      for (const name of testCases) {
        const values = {
          clientId,
          responseUri,
          verifierGeneratedNonce,
          mdocGeneratedNonce,
          [name]: 'wrong',
        }
        it(`with a different ${name}`, async () => {
          try {
            const mdocDeviceResponse = MdocDeviceResponse.fromBase64Url(deviceResponse)
            await mdocDeviceResponse.verify(agent.context, {
              trustedCertificates: [ISSUER_CERTIFICATE_P256],
              sessionTranscriptOptions: {
                type: 'openId4Vp',
                clientId: values.clientId,
                responseUri: values.responseUri,
                verifierGeneratedNonce: values.verifierGeneratedNonce,
                mdocGeneratedNonce: values.mdocGeneratedNonce,
              },
            })
            throw new Error('should not validate with different transcripts')
          } catch (error) {
            expect((error as Error).message).toMatch(
              'Unable to verify deviceAuth signature (ECDSA/EdDSA): Device signature must be valid'
            )
          }
        })
      }
    })

    it('should contain the validity info', () => {
      expect(parsedDocument.validityInfo).toBeDefined()
      expect(parsedDocument.validityInfo.signed).toEqual(new Date('2023-10-24'))
      expect(parsedDocument.validityInfo.validFrom).toEqual(new Date('2023-10-24'))
      expect(parsedDocument.validityInfo.validUntil).toEqual(new Date('2050-10-24'))
    })

    it('should contain the device namespaces', () => {
      expect(parsedDocument.deviceSignedNamespaces).toEqual({
        'com.foobar-device': {
          test: 1234,
        },
      })
    })
  })

  describe('EdDSA', () => {
    beforeEach(async () => {
      agent = new Agent(getAgentOptions('mdoc-test-agent-eddsa', {}))
      await agent.initialize()
    })

    test('should verify with EdDSA', async () => {
      const issuerKey = await agent.kms.createKey({
        type: {
          kty: 'OKP',
          crv: 'Ed25519',
        },
      })

      const holderKey = await agent.kms.createKey({
        type: {
          kty: 'OKP',
          crv: 'Ed25519',
        },
      })

      const issuerCertificate = await agent.x509.createCertificate({
        authorityKey: PublicJwk.fromPublicJwk(issuerKey.publicJwk),
        issuer: 'C=US,ST=New York',
        validity: {
          notBefore: new Date('2020-01-01'),
          notAfter: new Date(Date.now() + 1000 * 3600),
        },
      })

      const mdoc = await Mdoc.sign(agent.context, {
        docType: 'org.iso.18013.5.1.mDL',
        validityInfo: {
          signed: new Date('2023-10-24'),
          validUntil: new Date('2050-10-24'),
        },
        holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
        issuerCertificate,
        namespaces: {
          'org.iso.18013.5.1': {
            family_name: 'Jones',
            given_name: 'Ava',
            birth_date: '2007-03-25',
            issue_date: '2023-09-01',
            expiry_date: '2028-09-31',
            issuing_country: 'US',
            issuing_authority: 'NY DMV',
            document_number: '01-856-5050',
            portrait: 'bstr',
            driving_privileges: [
              {
                vehicle_category_code: 'C',
                issue_date: '2023-09-01',
                expiry_date: '2028-09-31',
              },
            ],
            un_distinguishing_sign: 'tbd-us.ny.dmv',

            sex: 'F',
            height: '5\' 8"',
            weight: '120lb',
            eye_colour: 'brown',
            hair_colour: 'brown',
            resident_addres: '123 Street Rd',
            resident_city: 'Brooklyn',
            resident_state: 'NY',
            resident_postal_code: '19001',
            resident_country: 'US',
            issuing_jurisdiction: 'New York',
          },
        },
      })

      //  This is the Device side

      const result = await MdocDeviceResponse.createPresentationDefinitionDeviceResponse(agent.context, {
        mdocs: [mdoc],
        presentationDefinition: PRESENTATION_DEFINITION_1,
        sessionTranscriptOptions: {
          type: 'openId4Vp',
          clientId,
          responseUri,
          verifierGeneratedNonce,
          mdocGeneratedNonce,
        },
        deviceNameSpaces: {
          'com.foobar-device': { test: 1234 },
        },
      })
      deviceResponse = result.deviceResponseBase64Url

      const parsed = parseDeviceResponse(TypedArrayEncoder.fromBase64(deviceResponse))
      expect(parsed.documents).toHaveLength(1)

      const prepared = parsed.documents[0].prepare()
      const docType = prepared.get('docType') as string
      const issuerSigned = cborEncode(prepared.get('issuerSigned'))
      const deviceSigned = cborEncode(prepared.get('deviceSigned'))
      parsedDocument = Mdoc.fromDeviceSignedDocument(
        TypedArrayEncoder.toBase64URL(issuerSigned),
        TypedArrayEncoder.toBase64URL(deviceSigned),
        docType
      )

      expect(parsed.documents[0].issuerSigned.issuerAuth.algName).toBe('EdDSA')
      await MdocDeviceResponse.fromBase64Url(result.deviceResponseBase64Url).verify(agent.context, {
        trustedCertificates: [issuerCertificate.toString('pem')],
        sessionTranscriptOptions: {
          type: 'openId4Vp',
          clientId,
          responseUri,
          verifierGeneratedNonce,
          mdocGeneratedNonce,
        },
      })
    })
  })
})
