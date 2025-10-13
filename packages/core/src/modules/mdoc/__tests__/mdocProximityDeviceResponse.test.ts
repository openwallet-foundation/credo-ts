import { DeviceRequest, cborEncode, DeviceResponse, Document, DataItem } from '@animo-id/mdoc'

import { Agent, X509Certificate } from '../../..'
import { getAgentOptions } from '../../../../tests'
import { TypedArrayEncoder } from '../../../utils'
import { PublicJwk } from '../../kms'
import { Mdoc } from '../Mdoc'
import { MdocDeviceResponse } from '../MdocDeviceResponse'
import { namespacesMapToRecord } from '../mdocUtil'

const DEVICE_JWK_PUBLIC = {
  kty: 'EC',
  x: 'iBh5ynojixm_D0wfjADpouGbp6b3Pq6SuFHU3htQhVk',
  y: 'oxS1OAORJ7XNUHNfVFGeM8E0RQVFxWA62fJj-sxW03c',
  crv: 'P-256',
  use: undefined,
} as const

const DEVICE_JWK_PRIVATE = {
  ...DEVICE_JWK_PUBLIC,
  d: 'eRpAZr3eV5xMMnPG3kWjg90Y-bBff9LqmlQuk49HUtA',
} as const

const ISSUER_PRIVATE_KEY_JWK = {
  kty: 'EC',
  kid: '1234',
  x: 'iTwtg0eQbcbNabf2Nq9L_VM_lhhPCq2s0Qgw2kRx29s',
  y: 'YKwXDRz8U0-uLZ3NSI93R_35eNkl6jHp6Qg8OCup7VM',
  crv: 'P-256',
  d: 'o6PrzBm1dCfSwqJHW6DVqmJOCQSIAosrCPfbFJDMNp4',
} as const

const ISSUER_CERTIFICATE = `-----BEGIN CERTIFICATE-----
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

const DEVICE_REQUEST_1 = DeviceRequest.fromEncodedStructure({
  version: '1.0',
  docRequests: [
    {
      itemsRequest: DataItem.fromData({
        docType: 'org.iso.18013.5.1.mDL',
        nameSpaces: new Map([
          [
            'org.iso.18013.5.1',
            new Map([
              ['family_name', false],
              ['given_name', false],
              ['birth_date', false],
              ['issue_date', false],
              ['expiry_date', false],
              ['issuing_country', false],
              ['issuing_authority', false],
              ['issuing_jurisdiction', false],
              ['document_number', false],
              ['portrait', false],
              ['driving_privileges', false],
              ['un_distinguishing_sign', false],
            ]),
          ],
        ]),
      }),
    },
  ],
})

describe('mdoc device-response proximity test', () => {
  let mdoc: Mdoc
  let parsedDocument: Mdoc
  let agent: Agent

  beforeEach(async () => {
    agent = new Agent(getAgentOptions('mdoc-test-agent', {}))
    await agent.initialize()

    const importedDeviceKey = await agent.kms.importKey({
      privateJwk: DEVICE_JWK_PRIVATE,
    })

    const importedIssuerKey = await agent.kms.importKey({
      privateJwk: ISSUER_PRIVATE_KEY_JWK,
    })
    const issuerCertificate = X509Certificate.fromEncodedCertificate(ISSUER_CERTIFICATE)
    issuerCertificate.publicJwk.keyId = importedIssuerKey.keyId

    mdoc = await Mdoc.sign(agent.context, {
      docType: 'org.iso.18013.5.1.mDL',
      validityInfo: {
        signed: new Date('2023-10-24'),
        validUntil: new Date('2050-10-24'),
      },
      holderKey: PublicJwk.fromPublicJwk(importedDeviceKey.publicJwk),
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
      const result = await MdocDeviceResponse.createDeviceResponse(agent.context, {
        mdocs: [mdoc],

        documentRequests: DEVICE_REQUEST_1.docRequests.map((v) => {
          return {
            docType: v.itemsRequest.docType,
            nameSpaces: namespacesMapToRecord(v.itemsRequest.namespaces),
          }
        }),
        sessionTranscriptOptions: {
          type: 'sesionTranscriptBytes',
          sessionTranscriptBytes: cborEncode(new Uint8Array([1, 2, 3])),
        },
        deviceNameSpaces: {
          'com.foobar-device': { test: 1234 },
        },
      })

      const parsed = DeviceResponse.fromEncodedStructure(result)
      expect(parsed.documents).toHaveLength(1)

      const prepared = parsed.documents?.[0] as Document
      const docType = prepared.docType

      const issuerSigned = prepared.issuerSigned.encode()
      const deviceSigned = prepared.deviceSigned.encode()
      parsedDocument = Mdoc.fromDeviceSignedDocument(
        TypedArrayEncoder.toBase64URL(issuerSigned),
        TypedArrayEncoder.toBase64URL(deviceSigned),
        docType
      )
    }
  })

  it('should contain the device namespaces', () => {
    expect(parsedDocument.deviceSignedNamespaces).toEqual({
      'com.foobar-device': {
        test: 1234,
      },
    })
  })
})
