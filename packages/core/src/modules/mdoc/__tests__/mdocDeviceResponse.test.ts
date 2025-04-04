import { Optionality } from '@sphereon/pex-models'

import { getInMemoryAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import { KeyType } from '../../../crypto'
import { X509Service } from '../../x509'
import { Mdoc } from '../Mdoc'
import { MdocDeviceResponse } from '../MdocDeviceResponse'

describe('mdoc device-response test', () => {
  const agent = new Agent(getInMemoryAgentOptions('mdoc-test-agent', {}))
  beforeAll(async () => {
    await agent.initialize()
  })

  test('can limit the disclosure', async () => {
    const holderKey = await agent.context.wallet.createKey({
      keyType: KeyType.P256,
    })
    const issuerKey = await agent.context.wallet.createKey({
      keyType: KeyType.P256,
    })

    const currentDate = new Date()
    currentDate.setDate(currentDate.getDate() - 1)
    const nextDay = new Date(currentDate)
    nextDay.setDate(currentDate.getDate() + 2)

    const certificate = await X509Service.createCertificate(agent.context, {
      issuer: 'CN=credo',
      authorityKey: issuerKey,
      validity: {
        notBefore: currentDate,
        notAfter: nextDay,
      },
    })

    const issuerCertificate = certificate.toString('pem')

    const mdoc = await Mdoc.sign(agent.context, {
      docType: 'org.iso.18013.5.1.mDL',
      holderKey: holderKey,
      namespaces: {
        hello: {
          world: 'from-mdoc',
          secret: 'value',
          nicer: 'dicer',
        },
      },
      issuerCertificate,
    })

    const limitedDisclosedPayload = MdocDeviceResponse.limitDisclosureToInputDescriptor({
      mdoc,
      inputDescriptor: {
        id: mdoc.docType,
        format: {
          mso_mdoc: {
            alg: ['ES256'],
          },
        },
        constraints: {
          limit_disclosure: Optionality.Required,
          fields: [
            {
              path: ["$['hello']['world']"],
              intent_to_retain: true,
            },
            {
              path: ["$['hello']['nicer']"],
              intent_to_retain: false,
            },
          ],
        },
      },
    })

    expect(limitedDisclosedPayload).toStrictEqual({
      hello: {
        world: 'from-mdoc',
        nicer: 'dicer',
      },
    })
  })

  test('verify OpenID4VP device response from Google CM Wallet', async () => {
    const rootCertificate = `-----BEGIN CERTIFICATE-----
MIICkjCCAjmgAwIBAgIUIrllgKEU8qxSupeyniOVstAG4SgwCgYIKoZIzj0EAwIw
eTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDU1v
dW50YWluIFZpZXcxHDAaBgNVBAoME0RpZ2l0YWwgQ3JlZGVudGlhbHMxHzAdBgNV
BAMMFmRpZ2l0YWxjcmVkZW50aWFscy5kZXYwHhcNMjUwMjE4MTg0MDU3WhcNMzUw
MjA2MTg0MDU3WjB5MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEW
MBQGA1UEBwwNTW91bnRhaW4gVmlldzEcMBoGA1UECgwTRGlnaXRhbCBDcmVkZW50
aWFsczEfMB0GA1UEAwwWZGlnaXRhbGNyZWRlbnRpYWxzLmRldjBZMBMGByqGSM49
AgEGCCqGSM49AwEHA0IABNcHRK+Y2b9qPzjSGABUP3IKOJu5/sYBCur6sTV7AHIb
OG/YbBPCOWwAQQNnTaBWk8tey63NgOvp8IphAjuSVlqjgZ4wgZswHQYDVR0OBBYE
FKJP9InZfEbobqOG2UdIzsy+3M/1MB8GA1UdIwQYMBaAFKJP9InZfEbobqOG2UdI
zsy+3M/1MBIGA1UdEwEB/wQIMAYBAf8CAQAwDgYDVR0PAQH/BAQDAgEGMCoGA1Ud
EgQjMCGGH2h0dHBzOi8vZGlnaXRhbC1jcmVkZW50aWFscy5kZXYwCQYDVR0fBAIw
ADAKBggqhkjOPQQDAgNHADBEAiA1snaKSxWSuQc45aZ5mBdYI7OVB1qzAiel0vVA
B+kN6gIgKp/V7J2+2AAIRFfgexm7+72NaWGCkygXWfRPpbJ1eDk=
-----END CERTIFICATE-----`

    const documentSignerCertificate = `-----BEGIN CERTIFICATE-----
MIICwDCCAmegAwIBAgIUHn8bMq1PNO/ksMwHt7DjM6cLGE0wCgYIKoZIzj0EAwIw
eTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDU1v
dW50YWluIFZpZXcxHDAaBgNVBAoME0RpZ2l0YWwgQ3JlZGVudGlhbHMxHzAdBgNV
BAMMFmRpZ2l0YWxjcmVkZW50aWFscy5kZXYwHhcNMjUwMjE5MjMzMDE4WhcNMjYw
MjE5MjMzMDE4WjB5MQswCQYDVQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEW
MBQGA1UEBwwNTW91bnRhaW4gVmlldzEcMBoGA1UECgwTRGlnaXRhbCBDcmVkZW50
aWFsczEfMB0GA1UEAwwWZGlnaXRhbGNyZWRlbnRpYWxzLmRldjBZMBMGByqGSM49
AgEGCCqGSM49AwEHA0IABOt5Nivi1/OXw1AEfYPh42Is41VrNg9qaMdYuw3cavhs
Ca+aXV0NmTl2EsNaJ5GWmMoAD8ikwAFszYhIeNgF42mjgcwwgckwHwYDVR0jBBgw
FoAUok/0idl8Ruhuo4bZR0jOzL7cz/UwHQYDVR0OBBYEFN/+aloS6cBixLyYpyXS
2XD3emAoMDQGA1UdHwQtMCswKaAnoCWGI2h0dHBzOi8vZGlnaXRhbC1jcmVkZW50
aWFscy5kZXYvY3JsMCoGA1UdEgQjMCGGH2h0dHBzOi8vZGlnaXRhbC1jcmVkZW50
aWFscy5kZXYwDgYDVR0PAQH/BAQDAgeAMBUGA1UdJQEB/wQLMAkGByiBjF0FAQIw
CgYIKoZIzj0EAwIDRwAwRAIgYcXL9XzB43vy4LEz2h8gMQRdcJtaIRQOemgwm8sH
QucCIHCvouHEm/unjBXMCeUZ7QR/ympjGyHITw25/B9H9QsC
-----END CERTIFICATE-----`

    const deviceResponseBase64url =
      'o2d2ZXJzaW9uYzEuMGlkb2N1bWVudHOBo2dkb2NUeXBldW9yZy5pc28uMTgwMTMuNS4xLm1ETGxpc3N1ZXJTaWduZWSiam5hbWVTcGFjZXOhcW9yZy5pc28uMTgwMTMuNS4xgtgYWFGkaGRpZ2VzdElEAWZyYW5kb21QnJ-3pUCHnDHOH9ioS9e08HFlbGVtZW50SWRlbnRpZmllcmpnaXZlbl9uYW1lbGVsZW1lbnRWYWx1ZWNKb27YGFhUpGhkaWdlc3RJRABmcmFuZG9tUIdrm-vaYFzySJaTmIQCWF9xZWxlbWVudElkZW50aWZpZXJrZmFtaWx5X25hbWVsZWxlbWVudFZhbHVlZVNtaXRoamlzc3VlckF1dGiEQ6EBJqEYIVkCxDCCAsAwggJnoAMCAQICFB5_GzKtTzTv5LDMB7ew4zOnCxhNMAoGCCqGSM49BAMCMHkxCzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRYwFAYDVQQHDA1Nb3VudGFpbiBWaWV3MRwwGgYDVQQKDBNEaWdpdGFsIENyZWRlbnRpYWxzMR8wHQYDVQQDDBZkaWdpdGFsY3JlZGVudGlhbHMuZGV2MB4XDTI1MDIxOTIzMzAxOFoXDTI2MDIxOTIzMzAxOFoweTELMAkGA1UEBhMCVVMxEzARBgNVBAgMCkNhbGlmb3JuaWExFjAUBgNVBAcMDU1vdW50YWluIFZpZXcxHDAaBgNVBAoME0RpZ2l0YWwgQ3JlZGVudGlhbHMxHzAdBgNVBAMMFmRpZ2l0YWxjcmVkZW50aWFscy5kZXYwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNCAATreTYr4tfzl8NQBH2D4eNiLONVazYPamjHWLsN3Gr4bAmvml1dDZk5dhLDWieRlpjKAA_IpMABbM2ISHjYBeNpo4HMMIHJMB8GA1UdIwQYMBaAFKJP9InZfEbobqOG2UdIzsy-3M_1MB0GA1UdDgQWBBTf_mpaEunAYsS8mKcl0tlw93pgKDA0BgNVHR8ELTArMCmgJ6AlhiNodHRwczovL2RpZ2l0YWwtY3JlZGVudGlhbHMuZGV2L2NybDAqBgNVHRIEIzAhhh9odHRwczovL2RpZ2l0YWwtY3JlZGVudGlhbHMuZGV2MA4GA1UdDwEB_wQEAwIHgDAVBgNVHSUBAf8ECzAJBgcogYxdBQECMAoGCCqGSM49BAMCA0cAMEQCIGHFy_V8weN78uCxM9ofIDEEXXCbWiEUDnpoMJvLB0LnAiBwr6LhxJv7p4wVzAnlGe0Ef8pqYxshyE8NufwfR_ULAlkButgYWQG1pmd2ZXJzaW9uYzEuMG9kaWdlc3RBbGdvcml0aG1nU0hBLTI1Nmdkb2NUeXBldW9yZy5pc28uMTgwMTMuNS4xLm1ETGx2YWx1ZURpZ2VzdHOhcW9yZy5pc28uMTgwMTMuNS4xowBYIF4np1s8h5zq4R447fmweHJCW6Nd0X9qIlFVmdBckcxQAVgg5epO0W1CanUYkN3my72qMFM_NnUTmlUcXuYpkzhCK8ICWCAA5AsOZa7MqBIVYBoG7kGirGgnXgj2gW5ZN1MtEKKJvm1kZXZpY2VLZXlJbmZvoWlkZXZpY2VLZXmkAQIgASFYIITrf6TK84s7dF1jir4ZcQ3mnpOnnBLlOgI_rhbTqBfeIlgg4-d5b1QVCsUwKg3UoYLAn22ttZofjKqX6ajH0Jq7TeJsdmFsaWRpdHlJbmZvo2ZzaWduZWTAeBsyMDI1LTAyLTE5VDIzOjM2OjU4LjIxMDM5MVppdmFsaWRGcm9twHgbMjAyNS0wMi0xOVQyMzozNjo1OC4yMTAzOTlaanZhbGlkVW50aWzAeBsyMDM1LTAyLTA3VDIzOjM2OjU4LjIxMDM5OVpYQH2YP3brP6bfJDJO_FoaPUWwB5LtpYVYKChulL-3yQesOMekny68Gt-G9J3rEZMw7MUI64Y35nWJMqIF_9xB9zFsZGV2aWNlU2lnbmVkompuYW1lU3BhY2Vz2BhBoGpkZXZpY2VBdXRooW9kZXZpY2VTaWduYXR1cmWEQ6EBJqD2WEB40fYSCEZYZoYJAFRJYzez9XksFIHLwTU8b8a3vIalmOaVSFPuc_J-qzjAVrxLL1Lxq1qU0whasZmYSp337uqqZnN0YXR1cwA'

    const chain = await X509Service.validateCertificateChain(agent.context, {
      certificateChain: [documentSignerCertificate],
      trustedCertificates: [rootCertificate],
      verificationDate: new Date('2025-04-04'),
    })
    expect(chain.length).toEqual(2)

    const chainWithSignerCertificateTrusted = await X509Service.validateCertificateChain(agent.context, {
      certificateChain: [documentSignerCertificate],
      trustedCertificates: [documentSignerCertificate],
      verificationDate: new Date('2025-04-04'),
    })
    expect(chainWithSignerCertificateTrusted.length).toEqual(1)

    const deviceResponse = MdocDeviceResponse.fromBase64Url(deviceResponseBase64url)

    await deviceResponse.verify(agent.context, {
      trustedCertificates: [rootCertificate],
      now: new Date('2025-04-04'),
      sessionTranscriptOptions: {
        type: 'openId4VpDcApi',
        clientId: 'x509_san_dns:7f95-217-123-18-26.ngrok-free.app',
        origin: 'https://0663-217-123-18-26.ngrok-free.app',
        verifierGeneratedNonce: '121784205639044947422645',
      },
    })
  })
})
