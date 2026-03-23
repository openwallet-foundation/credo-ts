import { DeviceRequest, DocRequest, ItemsRequest, SessionTranscript } from '@owf/mdoc'
import { getAgentOptions } from '../../../../tests'
import { Agent, TypedArrayEncoder, X509Certificate } from '../../..'
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

const DEVICE_REQUEST_1 = DeviceRequest.create({
  version: '1.0',
  docRequests: [
    DocRequest.create({
      itemsRequest: ItemsRequest.create({
        docType: 'org.iso.18013.5.1.mDL',
        namespaces: new Map([
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
    }),
  ],
})

describe('mdoc device-response proximity test', () => {
  let mdoc: Mdoc
  let parsedDeviceResponse: MdocDeviceResponse
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
    parsedDeviceResponse = await MdocDeviceResponse.createDeviceResponse(agent.context, {
      mdocs: [mdoc],

      documentRequests: DEVICE_REQUEST_1.docRequests.map((v) => {
        return {
          docType: v.itemsRequest.docType,
          nameSpaces: namespacesMapToRecord(v.itemsRequest.namespaces),
        }
      }),

      sessionTranscriptOptions: {
        type: 'sesionTranscriptBytes',
        sessionTranscriptBytes: SessionTranscript.decode(
          TypedArrayEncoder.fromHex(
            'd81859024183d8185858a20063312e30018201d818584ba4010220012158205a88d182bce5f42efa59943f33359d2e8a968ff289d93e5fa444b624343167fe225820b16e8cf858ddc7690407ba61d4c338237a8cfcf3de6aa672fc60a557aa32fc67d818584ba40102200121582060e3392385041f51403051f2415531cb56dd3f999c71687013aac6768bc8187e225820e58deb8fdbe907f7dd5368245551a34796f7d2215c440c339bb0f7b67beccdfa8258c391020f487315d10209616301013001046d646f631a200c016170706c69636174696f6e2f766e642e626c7565746f6f74682e6c652e6f6f6230081b28128b37282801021c015c1e580469736f2e6f72673a31383031333a646576696365656e676167656d656e746d646f63a20063312e30018201d818584ba4010220012158205a88d182bce5f42efa59943f33359d2e8a968ff289d93e5fa444b624343167fe225820b16e8cf858ddc7690407ba61d4c338237a8cfcf3de6aa672fc60a557aa32fc6758cd91022548721591020263720102110204616301013000110206616301036e6663005102046163010157001a201e016170706c69636174696f6e2f766e642e626c7565746f6f74682e6c652e6f6f6230081b28078080bf2801021c021107c832fff6d26fa0beb34dfcd555d4823a1c11010369736f2e6f72673a31383031333a6e66636e6663015a172b016170706c69636174696f6e2f766e642e7766612e6e616e57030101032302001324fec9a70b97ac9684a4e326176ef5b981c5e8533e5f00298cfccbc35e700a6b020414'
          )
        ).encode(),
      },

      deviceNameSpaces: {
        'com.foobar-device': { test: 1234 },
      },
    })
  })

  it('should contain the device namespaces', () => {
    expect(
      Array.from(
        parsedDeviceResponse.deviceResponse.documents?.[0].deviceSigned.deviceNamespaces.deviceNamespaces.entries() ??
          []
      ).map(([namespace, value]) => [namespace, Array.from(value.deviceSignedItems.entries())])
    ).toEqual([['com.foobar-device', [['test', 1234]]]])
  })
})
