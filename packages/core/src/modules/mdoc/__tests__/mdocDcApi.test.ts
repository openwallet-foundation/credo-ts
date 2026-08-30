import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import type {
  TrustedIssuersForVerificationContext,
  VerificationSigner,
} from '../../../agent/TrustedIssuersForVerification'
import { PublicJwk } from '../../kms'
import { type X509Certificate, X509Service, type X509VerificationContext } from '../../x509'
import { Mdoc } from '../Mdoc'
import { MdocVerificationSessionExpiredError } from '../MdocError'
import { MdocVerificationSessionState } from '../MdocVerificationSessionState'
import { MdocRecord } from '../repository'

const origin = 'https://verifier.example.com'
const docType = 'org.iso.18013.5.1.mDL'
const nameSpace = 'org.iso.18013.5.1'
const otherDocType = 'org.iso.23220.photoid.1'
const otherNameSpace = 'org.iso.23220.1'

const getNextMonth = () => {
  const now = new Date()
  return now.getMonth() === 11
    ? new Date(now.getFullYear() + 1, 0, 1)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1)
}

describe('mdoc DC API (ISO 18013-7 Annex C)', () => {
  const agent = new Agent(getAgentOptions('mdoc-dc-api-test-agent', {}))

  let issuerCertificatePem: string
  let mdocRecord: MdocRecord
  let otherMdocRecord: MdocRecord

  beforeAll(async () => {
    await agent.initialize()

    const issuerKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const holderKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const issuerCertificate = await X509Service.createCertificate(agent.context, {
      issuer: 'CN=credo, C=NL',
      authorityKey: PublicJwk.fromPublicJwk(issuerKey.publicJwk),
      validity: { notBefore, notAfter: getNextMonth() },
    })
    issuerCertificatePem = issuerCertificate.toString('pem')

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

    const photoId = await Mdoc.sign(agent.context, {
      docType: otherDocType,
      validityInfo: { validUntil: getNextMonth() },
      holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
      namespaces: { [otherNameSpace]: { family_name: 'Doe', given_name: 'John' } },
      issuerCertificate,
    })
    photoId.deviceKeyId = holderKey.keyId

    otherMdocRecord = await agent.mdoc.store({ record: MdocRecord.fromMdoc(photoId) })
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  const createSession = () =>
    agent.mdoc.createDcApiVerificationSession({
      docRequests: [{ docType, nameSpaces: { [nameSpace]: { family_name: true, given_name: false } } }],
    })

  test('request → resolve → respond → verify', async () => {
    const { verificationSession, request } = await createSession()

    expect(verificationSession.state).toBe(MdocVerificationSessionState.RequestCreated)
    expect(request.deviceRequest).toEqual(expect.any(String))
    expect(request.encryptionInfo).toEqual(expect.any(String))
    expect(verificationSession.sessionTranscript).toEqual({
      type: 'isoMdocDcApi',
      encryptionInfoBase64Url: request.encryptionInfo,
      nonce: expect.any(String),
    })

    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

    expect(resolved.origin).toBe(origin)
    expect(resolved.docRequests).toHaveLength(1)
    expect(resolved.docRequests[0]).toMatchObject({
      docType,
      readerAuth: undefined,
      nameSpaces: { [nameSpace]: { family_name: true, given_name: false } },
    })
    expect(resolved.docRequests[0].matches).toHaveLength(1)
    expect(resolved.docRequests[0].matches[0]).toMatchObject({
      isFullMatch: true,
      disclosedClaims: { [nameSpace]: { family_name: 'Doe', given_name: 'John' } },
    })

    const response = await agent.mdoc.createDcApiResponse({
      resolvedRequest: resolved,
      credentials: [{ docRequestIndex: 0, record: mdocRecord.id }],
    })

    expect(response.response).toEqual(expect.any(String))

    const result = await agent.mdoc.verifyDcApiResponse({
      verificationSessionId: verificationSession.id,
      response,
      origin,
      trustedCertificates: [issuerCertificatePem],
    })

    expect(result.origin).toBe(origin)
    expect(result.verificationSession.state).toBe(MdocVerificationSessionState.ResponseVerified)
    expect(result.verificationSession.getSessionTranscript('isoMdocDcApi').origin).toBe(origin)
    expect(result.deviceResponse.issuerClaims).toEqual({
      [docType]: { [nameSpace]: { family_name: 'Doe', given_name: 'John' } },
    })
  })

  test('the session key is kept after a response is verified', async () => {
    const { verificationSession, request } = await createSession()

    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
    const response = await agent.mdoc.createDcApiResponse({
      resolvedRequest: resolved,
      credentials: [{ docRequestIndex: 0, record: mdocRecord }],
    })

    await agent.mdoc.verifyDcApiResponse({
      verificationSessionId: verificationSession.id,
      response,
      origin,
      trustedCertificates: [issuerCertificatePem],
    })

    await expect(agent.kms.getPublicKey({ keyId: verificationSession.sessionKeyId })).resolves.toBeDefined()
  })

  test('a response created for another origin does not verify', async () => {
    const { verificationSession, request } = await createSession()

    // The wallet answers the request as if it came from a different origin, which binds the
    // response to a different session transcript.
    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin: 'https://attacker.example.com' })
    const response = await agent.mdoc.createDcApiResponse({
      resolvedRequest: resolved,
      credentials: [{ docRequestIndex: 0, record: mdocRecord }],
    })

    await expect(
      agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })
    ).rejects.toThrow()

    const session = await agent.mdoc.getVerificationSessionById(verificationSession.id)
    expect(session.state).toBe(MdocVerificationSessionState.Error)
  })

  test('verifying against a different origin than the response was created for fails', async () => {
    const { verificationSession, request } = await createSession()

    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
    const response = await agent.mdoc.createDcApiResponse({
      resolvedRequest: resolved,
      credentials: [{ docRequestIndex: 0, record: mdocRecord }],
    })

    await expect(
      agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin: 'https://other.example.com',
        trustedCertificates: [issuerCertificatePem],
      })
    ).rejects.toThrow()

    const session = await agent.mdoc.getVerificationSessionById(verificationSession.id)
    expect(session.state).toBe(MdocVerificationSessionState.Error)
  })

  test('an expired session cannot be used', async () => {
    const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
      docRequests: [{ docType, nameSpaces: { [nameSpace]: { family_name: true } } }],
      expiresInSeconds: -1,
    })

    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
    const response = await agent.mdoc.createDcApiResponse({
      resolvedRequest: resolved,
      credentials: [{ docRequestIndex: 0, record: mdocRecord }],
    })

    await expect(
      agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })
    ).rejects.toThrow(MdocVerificationSessionExpiredError)
  })

  test('only mdocs of the requested doctype are matched', async () => {
    const { request } = await createSession()

    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

    expect(resolved.docRequests).toHaveLength(1)
    expect(resolved.docRequests[0].matches.map(({ record }) => record.id)).toEqual([mdocRecord.id])
  })

  test('a request for multiple doctypes matches each doc request separately', async () => {
    const { request } = await agent.mdoc.createDcApiVerificationSession({
      docRequests: [
        { docType, nameSpaces: { [nameSpace]: { family_name: true } } },
        { docType: otherDocType, nameSpaces: { [otherNameSpace]: { given_name: true } } },
      ],
    })

    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

    expect(resolved.docRequests.map(({ docType: requested }) => requested)).toEqual([docType, otherDocType])
    expect(resolved.docRequests[0].matches.map(({ record }) => record.id)).toEqual([mdocRecord.id])
    expect(resolved.docRequests[1].matches.map(({ record }) => record.id)).toEqual([otherMdocRecord.id])
    expect(resolved.docRequests[1].matches[0]).toMatchObject({
      isFullMatch: true,
      disclosedClaims: { [otherNameSpace]: { given_name: 'John' } },
    })
  })

  test('a request for an unknown doctype has no matches', async () => {
    const { request } = await agent.mdoc.createDcApiVerificationSession({
      docRequests: [{ docType: 'com.example.unknown', nameSpaces: { 'com.example': { family_name: true } } }],
    })

    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

    expect(resolved.docRequests[0].matches).toEqual([])
  })

  test('resolving without an origin aborts', async () => {
    const { request } = await createSession()

    // `origin` is required by the type; the runtime abort still has to hold for JS callers.
    await expect(agent.mdoc.resolveDcApiRequest({ request, origin: undefined as unknown as string })).rejects.toThrow(
      'No origin'
    )
  })

  test('a reader-authenticated request is verified against the reader certificate', async () => {
    const readerKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const readerCertificate = await X509Service.createCertificate(agent.context, {
      issuer: 'CN=credo-reader',
      authorityKey: PublicJwk.fromPublicJwk(readerKey.publicJwk),
      validity: { notBefore: new Date(Date.now() - 60_000), notAfter: getNextMonth() },
    })

    const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
      docRequests: [{ docType, nameSpaces: { [nameSpace]: { family_name: true } } }],
      readerAuth: { certificate: readerCertificate, origin },
    })

    const resolved = await agent.mdoc.resolveDcApiRequest({
      request,
      origin,
      trustedReaderCertificates: [readerCertificate],
    })

    expect(resolved.docRequests[0].readerAuth?.certificateChain).toHaveLength(1)

    const response = await agent.mdoc.createDcApiResponse({
      resolvedRequest: resolved,
      credentials: [{ docRequestIndex: 0, record: mdocRecord }],
    })

    const result = await agent.mdoc.verifyDcApiResponse({
      verificationSessionId: verificationSession.id,
      response,
      origin,
      trustedCertificates: [issuerCertificatePem],
    })

    expect(result.deviceResponse.issuerClaims).toEqual({
      [docType]: { [nameSpace]: { family_name: 'Doe' } },
    })
  })

  describe('reader authentication trust', () => {
    let readerCertificate: X509Certificate

    beforeAll(async () => {
      const readerKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
      readerCertificate = await X509Service.createCertificate(agent.context, {
        issuer: 'CN=credo-reader',
        authorityKey: PublicJwk.fromPublicJwk(readerKey.publicJwk),
        validity: { notBefore: new Date(Date.now() - 60_000), notAfter: getNextMonth() },
      })
    })

    afterEach(() => {
      agent.config.setTrustedIssuersForVerification(undefined)
      agent.x509.config.setTrustedCertificatesForVerification(undefined)
      agent.x509.config.setTrustedCertificates(undefined)
    })

    const createReaderAuthSession = () =>
      agent.mdoc.createDcApiVerificationSession({
        docRequests: [{ docType, nameSpaces: { [nameSpace]: { family_name: true } } }],
        readerAuth: { certificate: readerCertificate, origin },
      })

    test('calls getTrustedIssuersForVerification with the reader certificate chain', async () => {
      const { request } = await createReaderAuthSession()

      const contexts: TrustedIssuersForVerificationContext<VerificationSigner, { type: string }>[] = []
      agent.config.setTrustedIssuersForVerification(async (_agentContext, context) => {
        contexts.push(context)

        if (context.signer.method !== 'x509') throw new Error(`Unexpected signer method ${context.signer.method}`)

        // Trust whatever certificate the reader brings, like a wallet deciding on the leaf itself
        return {
          trustedIssuers: [{ method: 'x509', issuance: [context.signer.certificateChain[0].toString('pem')] }],
        }
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

      expect(resolved.docRequests[0].readerAuth?.certificateChain).toHaveLength(1)
      expect(contexts).toHaveLength(1)
      expect(contexts[0].signer).toEqual({
        method: 'x509',
        certificateChain: [expect.objectContaining({ rawCertificate: readerCertificate.rawCertificate })],
      })
      expect(contexts[0].verification).toEqual({
        type: 'mdocReaderAuth',
        exchange: { type: 'dcApi', origin },
        docType,
        nameSpaces: { [nameSpace]: { family_name: true } },
      })
    })

    test('calls the deprecated x509 callback when no trusted issuers are resolved', async () => {
      const { request } = await createReaderAuthSession()

      const contexts: X509VerificationContext[] = []
      agent.x509.config.setTrustedCertificatesForVerification((_agentContext, context) => {
        contexts.push(context)

        return [{ issuance: [context.certificateChain[0].toString('pem')] }]
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

      expect(resolved.docRequests[0].readerAuth?.certificateChain).toHaveLength(1)
      expect(contexts).toHaveLength(1)
      expect(contexts[0].certificateChain.map((certificate) => certificate.toString('pem'))).toEqual([
        readerCertificate.toString('pem'),
      ])
      expect(contexts[0].verification).toEqual({
        type: 'mdocReaderAuth',
        exchange: { type: 'dcApi', origin },
        docType,
        nameSpaces: { [nameSpace]: { family_name: true } },
      })
    })

    test('calls getTrustedIssuersForVerification before the deprecated x509 callback', async () => {
      const { request } = await createReaderAuthSession()

      const x509Callback = vi.fn()
      agent.x509.config.setTrustedCertificatesForVerification(x509Callback)
      agent.config.setTrustedIssuersForVerification(async (_agentContext, { signer }) => {
        if (signer.method !== 'x509') throw new Error(`Unexpected signer method ${signer.method}`)

        return { trustedIssuers: [{ method: 'x509', issuance: [signer.certificateChain[0].toString('pem')] }] }
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

      expect(resolved.docRequests[0].readerAuth?.certificateChain).toHaveLength(1)
      expect(x509Callback).not.toHaveBeenCalled()
    })

    test('a request from a reader the deprecated x509 callback does not trust does not resolve', async () => {
      const { request } = await createReaderAuthSession()

      agent.x509.config.setTrustedCertificatesForVerification(() => [])

      await expect(agent.mdoc.resolveDcApiRequest({ request, origin })).rejects.toThrow(
        'No trusted certificate was found while validating the X.509 chain'
      )
    })

    test('falls back to the statically configured trusted certificates', async () => {
      const { request } = await createReaderAuthSession()

      agent.x509.config.setTrustedCertificates([readerCertificate.toString('pem')])

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

      expect(resolved.docRequests[0].readerAuth?.certificateChain).toHaveLength(1)
    })

    test('throws when no trusted certificates are configured', async () => {
      const { request } = await createReaderAuthSession()

      await expect(agent.mdoc.resolveDcApiRequest({ request, origin })).rejects.toThrow(
        'No trusted certificates found. Cannot verify reader authentication.'
      )
    })

    test('a request from an untrusted reader does not resolve', async () => {
      const { request } = await createReaderAuthSession()

      agent.config.setTrustedIssuersForVerification(async () => ({ trustedIssuers: [] }))

      await expect(agent.mdoc.resolveDcApiRequest({ request, origin })).rejects.toThrow(
        'No trusted certificate was found while validating the X.509 chain'
      )
    })

    test('a request without reader authentication does not need trusted certificates', async () => {
      const { request } = await createSession()

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

      expect(resolved.docRequests[0].readerAuth).toBeUndefined()
    })
  })

  test('deleting a session deletes the session key with it', async () => {
    const { verificationSession } = await createSession()

    await agent.mdoc.deleteVerificationSessionById(verificationSession.id)

    await expect(agent.mdoc.getVerificationSessionById(verificationSession.id)).rejects.toThrow()
    await expect(agent.kms.getPublicKey({ keyId: verificationSession.sessionKeyId })).rejects.toThrow('not found')
  })

  test('the session key is kept when deleteAssociatedKey is false', async () => {
    const { verificationSession } = await createSession()

    await agent.mdoc.deleteVerificationSessionById(verificationSession.id, { deleteAssociatedKey: false })

    await expect(agent.mdoc.getVerificationSessionById(verificationSession.id)).rejects.toThrow()
    await expect(agent.kms.getPublicKey({ keyId: verificationSession.sessionKeyId })).resolves.toBeDefined()
  })

  describe('trusted certificate resolution', () => {
    // A response the verifier has not verified yet, so each test gets a session with an unused key
    const createResponse = async () => {
      const { verificationSession, request } = await createSession()
      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: resolved,
        credentials: [{ docRequestIndex: 0, record: mdocRecord }],
      })

      return { verificationSessionId: verificationSession.id, response }
    }

    afterEach(() => {
      agent.config.setTrustedIssuersForVerification(undefined)
      agent.x509.config.setTrustedCertificatesForVerification(undefined)
      agent.x509.config.setTrustedCertificates(undefined)
    })

    test('calls getTrustedCertificatesForVerification with the certificate chain of the mdoc', async () => {
      const { verificationSessionId, response } = await createResponse()

      const contexts: X509VerificationContext[] = []
      agent.x509.config.setTrustedCertificatesForVerification((_agentContext, context) => {
        contexts.push(context)

        // Trust whatever chain the document brings, like a demo verifier would
        return [{ issuance: [context.certificateChain[context.certificateChain.length - 1].toString('pem')] }]
      })

      const result = await agent.mdoc.verifyDcApiResponse({ verificationSessionId, response, origin })

      expect(result.verificationSession.state).toBe(MdocVerificationSessionState.ResponseVerified)
      expect(contexts).toHaveLength(1)
      expect(contexts[0].certificateChain.map((certificate) => certificate.toString('pem'))).toEqual([
        issuerCertificatePem,
      ])
      expect(contexts[0].verification).toEqual({ type: 'credential', credential: expect.any(Mdoc) })
    })

    test('calls getTrustedIssuersForVerification before the deprecated x509 callback', async () => {
      const { verificationSessionId, response } = await createResponse()

      const x509Callback = vi.fn()
      agent.x509.config.setTrustedCertificatesForVerification(x509Callback)
      agent.config.setTrustedIssuersForVerification(async (_agentContext, { signer }) => {
        if (signer.method !== 'x509') throw new Error(`Unexpected signer method ${signer.method}`)

        return {
          trustedIssuers: [
            {
              method: 'x509',
              issuance: [signer.certificateChain[signer.certificateChain.length - 1].toString('pem')],
            },
          ],
        }
      })

      const result = await agent.mdoc.verifyDcApiResponse({ verificationSessionId, response, origin })

      expect(result.verificationSession.state).toBe(MdocVerificationSessionState.ResponseVerified)
      expect(x509Callback).not.toHaveBeenCalled()
    })

    test('falls back to the statically configured trusted certificates', async () => {
      const { verificationSessionId, response } = await createResponse()

      agent.x509.config.setTrustedCertificates([issuerCertificatePem])

      const result = await agent.mdoc.verifyDcApiResponse({ verificationSessionId, response, origin })

      expect(result.verificationSession.state).toBe(MdocVerificationSessionState.ResponseVerified)
    })

    test('a document signed by an untrusted issuer does not verify', async () => {
      const { verificationSessionId, response } = await createResponse()

      agent.x509.config.setTrustedCertificatesForVerification(() => [])

      await expect(agent.mdoc.verifyDcApiResponse({ verificationSessionId, response, origin })).rejects.toThrow(
        `Mdoc with doctype ${docType} is not valid`
      )
    })
  })
})
