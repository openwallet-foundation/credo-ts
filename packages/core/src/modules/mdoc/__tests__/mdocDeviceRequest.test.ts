import {
  CoseKey,
  DeviceRequest,
  DocRequest,
  ItemsRequest,
  ProtectedHeaders,
  ReaderAuth,
  ReaderAuthentication,
  RegisteredCwtHeaderClaimKey,
  SessionTranscript,
  UnprotectedHeaders,
  Verifier,
} from '@owf/mdoc'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import type {
  TrustedIssuersForVerificationContext,
  VerificationSigner,
} from '../../../agent/TrustedIssuersForVerification'
import { getMdocContext } from '../../../crypto/contexts/mdocContext'
import { TypedArrayEncoder } from '../../../utils'
import { PublicJwk } from '../../kms'
import { type X509Certificate, X509Service } from '../../x509'
import { Mdoc } from '../Mdoc'
import { MdocError } from '../MdocError'
import type { MdocResolvedRequest } from '../MdocOptions'
import { mdocSigningJwk } from '../mdocUtil'
import { MdocRecord } from '../repository'
import { iso18013_5_SessionTranscriptBytesHex } from './mdoc.fixtures'

const docType = 'org.iso.18013.5.1.mDL'
const nameSpace = 'org.iso.18013.5.1'

const sessionTranscript = TypedArrayEncoder.fromHex(iso18013_5_SessionTranscriptBytesHex)

// The same engagement with a QR handover instead of the NFC one, so a session the request was not made in.
const otherSessionTranscript = (() => {
  const { deviceEngagement, eReaderKey } = SessionTranscript.from(sessionTranscript)
  if (!deviceEngagement || !eReaderKey) throw new Error('Expected a proximity session transcript')

  return SessionTranscript.forQrHandover({ deviceEngagement, eReaderKey }).encode()
})()

/**
 * Assert the stored mdocs satisfy every doc request of a request without use cases.
 */
function assertEveryDocRequestSatisfied(
  resolved: MdocResolvedRequest
): asserts resolved is Extract<MdocResolvedRequest, { success: true; useCasesSource: 'allDocRequests' }> {
  if (!resolved.success || resolved.useCasesSource !== 'allDocRequests') {
    throw new Error('Expected the stored mdocs to satisfy every doc request')
  }
}

const getNextMonth = () => {
  const now = new Date()
  return now.getMonth() === 11
    ? new Date(now.getFullYear() + 1, 0, 1)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

const createItemsRequest = (elements: Record<string, boolean>, itemsDocType = docType) =>
  ItemsRequest.create({ docType: itemsDocType, namespaces: new Map([[nameSpace, new Map(Object.entries(elements))]]) })

const encodeDeviceRequest = (docRequests: DocRequest[]) => DeviceRequest.create({ docRequests }).encode()

describe('mdoc device request (ISO 18013-5 proximity)', () => {
  const agent = new Agent(getAgentOptions('mdoc-device-request-test-agent', {}))

  let issuerCertificatePem: string
  let readerCertificate: X509Certificate
  let mdocRecord: MdocRecord

  beforeAll(async () => {
    await agent.initialize()

    const issuerKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const holderKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const readerKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const issuerCertificate = await X509Service.createCertificate(agent.context, {
      issuer: 'CN=credo, C=NL',
      authorityKey: PublicJwk.fromPublicJwk(issuerKey.publicJwk),
      validity: { notBefore, notAfter: getNextMonth() },
    })
    issuerCertificatePem = issuerCertificate.toString('pem')

    readerCertificate = await X509Service.createCertificate(agent.context, {
      issuer: 'CN=credo-reader',
      authorityKey: PublicJwk.fromPublicJwk(readerKey.publicJwk),
      validity: { notBefore, notAfter: getNextMonth() },
    })

    const mdoc = await Mdoc.sign(agent.context, {
      docType,
      validityInfo: { validUntil: getNextMonth() },
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: {
        [nameSpace]: {
          family_name: 'Doe',
          given_name: 'John',
          birth_date: '1990-01-01',
        },
      },
      issuerCertificate,
    })
    mdoc.deviceKeyId = holderKey.keyId

    mdocRecord = await agent.mdoc.store({ record: MdocRecord.fromMdoc(mdoc) })
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  /**
   * Sign a doc request with the reader key over a session transcript, as an mdoc reader does.
   */
  const createReaderAuthDocRequest = async (itemsRequest: ItemsRequest, readerSessionTranscript: Uint8Array) => {
    const signingKey = CoseKey.fromJwk(mdocSigningJwk(readerCertificate.publicJwk))

    const readerAuth = await ReaderAuth.create({
      protectedHeaders: ProtectedHeaders.create({
        protectedHeaders: new Map([[RegisteredCwtHeaderClaimKey.Algorithm, signingKey.algorithm]]),
      }),
      unprotectedHeaders: UnprotectedHeaders.create({
        unprotectedHeaders: new Map([[RegisteredCwtHeaderClaimKey.X5Chain, readerCertificate.rawCertificate]]),
      }),
      payload: null,
    }).sign(
      {
        signingKey,
        detachedPayload: ReaderAuthentication.create({
          sessionTranscript: SessionTranscript.from(readerSessionTranscript),
          itemsRequest,
        }).encode({ asDataItem: true }),
      },
      { sign: getMdocContext(agent.context, { keys: [readerCertificate.publicJwk] }).cose.sign1.sign }
    )

    return DocRequest.create({ itemsRequest, readerAuth })
  }

  test('request → resolve → respond → verify', async () => {
    const deviceRequest = encodeDeviceRequest([
      DocRequest.create({ itemsRequest: createItemsRequest({ family_name: true, given_name: false }) }),
    ])

    const resolved = await agent.mdoc.resolveDeviceRequest({ deviceRequest, sessionTranscript })

    expect(resolved.deviceRequest).toBe(deviceRequest)
    expect(resolved.sessionTranscript).toBe(sessionTranscript)
    assertEveryDocRequestSatisfied(resolved)
    expect(resolved.docRequests).toHaveLength(1)
    expect(resolved.docRequests[0]).toMatchObject({
      docRequestIndex: 0,
      docType,
      readerAuth: undefined,
      nameSpaces: { [nameSpace]: { family_name: true, given_name: false } },
      success: true,
      failedCredentials: [],
    })
    expect(resolved.docRequests[0].validCredentials).toHaveLength(1)
    expect(resolved.docRequests[0].validCredentials[0].record.id).toBe(mdocRecord.id)

    const sign = vi.spyOn(agent.kms, 'sign')
    const deviceResponse = await agent.mdoc.createDeviceResponse({
      resolvedRequest: resolved,
      credentials: [{ docRequestIndex: 0, record: mdocRecord.id }],
    })

    expect(sign).toHaveBeenCalledWith(expect.objectContaining({ keyId: mdocRecord.firstCredential.deviceKeyId }))
    sign.mockRestore()

    expect(deviceResponse.issuerClaims).toEqual({
      [docType]: { [nameSpace]: { family_name: 'Doe', given_name: 'John' } },
    })

    // What the reader does with the device response it decrypted from the session
    await deviceResponse.verify(agent.context, {
      trustedCertificates: [issuerCertificatePem],
      sessionTranscriptOptions: { type: 'sessionTranscriptBytes', sessionTranscriptBytes: sessionTranscript },
    })
    expect(
      Verifier.matchDeviceRequest({ deviceRequest, deviceResponse: deviceResponse.deviceResponse.encode() })
    ).toMatchObject({ success: true })
  })

  test('the selected credentials can be passed to createDeviceResponse as is', async () => {
    const resolved = await agent.mdoc.resolveDeviceRequest({
      deviceRequest: encodeDeviceRequest([
        DocRequest.create({ itemsRequest: createItemsRequest({ family_name: false, birth_date: false }) }),
      ]),
      sessionTranscript,
    })

    const deviceResponse = await agent.mdoc.createDeviceResponse(agent.mdoc.selectCredentialsForRequest(resolved))

    expect(deviceResponse.issuerClaims).toEqual({
      [docType]: { [nameSpace]: { family_name: 'Doe', birth_date: '1990-01-01' } },
    })
  })

  test('the session transcript can be passed with or without the SessionTranscriptBytes tag', async () => {
    const untaggedSessionTranscript = SessionTranscript.from(sessionTranscript).encode()
    const resolved = await agent.mdoc.resolveDeviceRequest({
      deviceRequest: encodeDeviceRequest([
        DocRequest.create({ itemsRequest: createItemsRequest({ family_name: false }) }),
      ]),
      sessionTranscript: untaggedSessionTranscript,
    })

    const deviceResponse = await agent.mdoc.createDeviceResponse({
      resolvedRequest: resolved,
      credentials: [{ docRequestIndex: 0, record: mdocRecord }],
    })

    await expect(
      deviceResponse.verify(agent.context, {
        trustedCertificates: [issuerCertificatePem],
        sessionTranscriptOptions: { type: 'sessionTranscriptBytes', sessionTranscriptBytes: sessionTranscript },
      })
    ).resolves.toBeDefined()
  })

  test('the device response is signed over the session transcript', async () => {
    const resolved = await agent.mdoc.resolveDeviceRequest({
      deviceRequest: encodeDeviceRequest([
        DocRequest.create({ itemsRequest: createItemsRequest({ family_name: false }) }),
      ]),
      sessionTranscript,
    })

    const deviceResponse = await agent.mdoc.createDeviceResponse({
      resolvedRequest: resolved,
      credentials: [{ docRequestIndex: 0, record: mdocRecord }],
    })

    await expect(
      deviceResponse.verify(agent.context, {
        trustedCertificates: [issuerCertificatePem],
        sessionTranscriptOptions: { type: 'sessionTranscriptBytes', sessionTranscriptBytes: otherSessionTranscript },
      })
    ).rejects.toThrow(MdocError)
  })

  test('a request for an unknown doctype has no matches', async () => {
    const resolved = await agent.mdoc.resolveDeviceRequest({
      deviceRequest: encodeDeviceRequest([
        DocRequest.create({ itemsRequest: createItemsRequest({ family_name: false }, 'org.example.unknown') }),
      ]),
      sessionTranscript,
    })

    expect(resolved.success).toBe(false)
    expect(resolved.docRequests[0]).toMatchObject({ success: false, validCredentials: [], failedCredentials: [] })
  })

  test('a device request that cannot be decoded is rejected', async () => {
    await expect(
      agent.mdoc.resolveDeviceRequest({ deviceRequest: new Uint8Array([1, 2, 3]), sessionTranscript })
    ).rejects.toThrow(new MdocError('Unable to decode the device request'))
  })

  describe('reader authentication', () => {
    afterEach(() => {
      agent.config.setTrustedIssuersForVerification(undefined)
    })

    test('a reader-authenticated request is verified against the reader certificate', async () => {
      const deviceRequest = encodeDeviceRequest([
        await createReaderAuthDocRequest(createItemsRequest({ family_name: true }), sessionTranscript),
      ])

      const resolved = await agent.mdoc.resolveDeviceRequest({
        deviceRequest,
        sessionTranscript,
        trustedReaderCertificates: [readerCertificate],
      })

      expect(resolved.docRequests[0].readerAuth?.certificateChain).toEqual([
        expect.objectContaining({ rawCertificate: readerCertificate.rawCertificate }),
      ])

      const deviceResponse = await agent.mdoc.createDeviceResponse({
        resolvedRequest: resolved,
        credentials: [{ docRequestIndex: 0, record: mdocRecord }],
      })

      expect(deviceResponse.issuerClaims).toEqual({ [docType]: { [nameSpace]: { family_name: 'Doe' } } })
    })

    test('calls getTrustedIssuersForVerification with the device request exchange', async () => {
      const deviceRequest = encodeDeviceRequest([
        await createReaderAuthDocRequest(createItemsRequest({ family_name: true }), sessionTranscript),
      ])

      const contexts: TrustedIssuersForVerificationContext<VerificationSigner, { type: string }>[] = []
      agent.config.setTrustedIssuersForVerification(async (_agentContext, context) => {
        contexts.push(context)

        if (context.signer.method !== 'x509') throw new Error(`Unexpected signer method ${context.signer.method}`)

        return {
          trustedIssuers: [{ method: 'x509', issuance: [context.signer.certificateChain[0].toString('pem')] }],
        }
      })

      const resolved = await agent.mdoc.resolveDeviceRequest({ deviceRequest, sessionTranscript })

      expect(resolved.docRequests[0].readerAuth?.certificateChain).toHaveLength(1)
      expect(contexts).toHaveLength(1)
      expect(contexts[0].verification).toEqual({
        type: 'mdocReaderAuth',
        exchange: { type: 'deviceRequest' },
        docType,
        nameSpaces: { [nameSpace]: { family_name: true } },
      })
    })

    test('a request signed over another session transcript does not resolve', async () => {
      const deviceRequest = encodeDeviceRequest([
        await createReaderAuthDocRequest(createItemsRequest({ family_name: true }), otherSessionTranscript),
      ])

      await expect(
        agent.mdoc.resolveDeviceRequest({
          deviceRequest,
          sessionTranscript,
          trustedReaderCertificates: [readerCertificate],
        })
      ).rejects.toThrow('Signature is invalid on the reader auth')
    })

    test('a request from an untrusted reader does not resolve', async () => {
      const deviceRequest = encodeDeviceRequest([
        await createReaderAuthDocRequest(createItemsRequest({ family_name: true }), sessionTranscript),
      ])

      agent.config.setTrustedIssuersForVerification(async () => ({ trustedIssuers: [] }))

      await expect(agent.mdoc.resolveDeviceRequest({ deviceRequest, sessionTranscript })).rejects.toThrow(
        'No trusted certificate was found while validating the X.509 chain'
      )
    })
  })
})
