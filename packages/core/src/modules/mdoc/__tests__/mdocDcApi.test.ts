import { type DocRequestMatchSuccess, UnsatisfiedDeviceRequestError } from '@owf/mdoc'
import { getAgentOptions } from '../../../../tests'
import { Agent } from '../../../agent/Agent'
import type {
  TrustedIssuersForVerificationContext,
  VerificationSigner,
} from '../../../agent/TrustedIssuersForVerification'
import { CredentialMultiInstanceUseMode } from '../../../utils/credentialUseTypes'
import { PublicJwk } from '../../kms'
import { type X509Certificate, X509Service, type X509VerificationContext } from '../../x509'
import { Mdoc } from '../Mdoc'
import { MdocDeviceRequestNotSatisfiedError, MdocVerificationSessionExpiredError } from '../MdocError'
import type {
  MdocDcApiCreateVerificationSessionOptions,
  MdocDeviceRequestMatch,
  MdocDocRequestInfo,
  MdocResolvedRequest,
} from '../MdocOptions'
import { MdocVerificationSessionState } from '../MdocVerificationSessionState'
import { MdocRecord } from '../repository'

const origin = 'https://verifier.example.com'
const docType = 'org.iso.18013.5.1.mDL'
const nameSpace = 'org.iso.18013.5.1'
const otherDocType = 'org.iso.23220.photoid.1'
const otherNameSpace = 'org.iso.23220.1'

/**
 * The per doc request matches of a response that satisfied every doc request, which is what a
 * session expects unless it requested its doc requests as alternatives.
 */
const matchedDocRequests = (deviceRequestMatch: MdocDeviceRequestMatch) => {
  const docRequests = deviceRequestMatch.docRequests
  if (!deviceRequestMatch.success || !docRequests.every((docRequest) => docRequest.success)) {
    throw new Error('Expected the device response to satisfy every doc request')
  }

  return docRequests as DocRequestMatchSuccess[]
}

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

describe('mdoc DC API (ISO 18013-7 Annex C)', () => {
  const agent = new Agent(getAgentOptions('mdoc-dc-api-test-agent', {}))

  let issuerCertificate: X509Certificate
  let issuerCertificatePem: string
  let mdocRecord: MdocRecord
  let otherMdocRecord: MdocRecord

  beforeAll(async () => {
    await agent.initialize()

    const issuerKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
    const holderKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    const notBefore = new Date(Date.now() - 24 * 60 * 60 * 1000)
    issuerCertificate = await X509Service.createCertificate(agent.context, {
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
    assertEveryDocRequestSatisfied(resolved)
    expect(resolved.docRequests[0]).toMatchObject({ success: true, failedCredentials: [] })
    expect(resolved.docRequests[0].validCredentials).toHaveLength(1)
    expect(resolved.docRequests[0].validCredentials[0]).toMatchObject({
      success: true,
      docType: { success: true, docType },
      claims: {
        success: true,
        validClaims: [
          { namespace: nameSpace, elementIdentifier: 'family_name', elementValue: 'Doe', source: 'issuerSigned' },
          { namespace: nameSpace, elementIdentifier: 'given_name', elementValue: 'John', source: 'issuerSigned' },
        ],
        failedClaims: [],
      },
    })
    expect(resolved.docRequests[0].validCredentials[0].record.id).toBe(mdocRecord.id)

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
    expect(result.deviceRequestMatch).toMatchObject({
      success: true,
      unrequestedDocuments: [],
      docRequests: [
        {
          docRequestIndex: 0,
          docType,
          success: true,
          validDocuments: [
            {
              documentIndex: 0,
              success: true,
              docType: { success: true, docType },
              claims: {
                success: true,
                unrequestedClaims: [],
                validClaims: [
                  { namespace: nameSpace, elementIdentifier: 'family_name', success: true, source: 'issuerSigned' },
                  { namespace: nameSpace, elementIdentifier: 'given_name', success: true, source: 'issuerSigned' },
                ],
                failedClaims: [],
              },
            },
          ],
          failedDocuments: [],
        },
      ],
    })
  })

  describe('device request matching', () => {
    // Without reader auth the device request is not bound to the session transcript, so a response
    // to another device request than the one the verifier sent still decrypts and verifies. Only
    // matching it against the device request of the session catches that.
    const createResponseToOtherDeviceRequest = async (options: MdocDcApiCreateVerificationSessionOptions) => {
      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession(options)
      const { request: otherRequest } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [{ docType, nameSpaces: { [nameSpace]: { family_name: true } } }],
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({
        request: { ...request, deviceRequest: otherRequest.deviceRequest },
        origin,
      })
      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: resolved,
        credentials: [{ docRequestIndex: 0, record: mdocRecord }],
      })

      return { verificationSessionId: verificationSession.id, response }
    }

    test('a response that leaves out a requested element does not verify', async () => {
      const { verificationSessionId, response } = await createResponseToOtherDeviceRequest({
        docRequests: [{ docType, nameSpaces: { [nameSpace]: { family_name: true, birth_date: false } } }],
      })

      const verification = agent.mdoc.verifyDcApiResponse({
        verificationSessionId,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      await expect(verification).rejects.toThrow(MdocDeviceRequestNotSatisfiedError)
      await expect(verification).rejects.toThrow(
        `Document 0: Element 'birth_date' in namespace '${nameSpace}' was not disclosed`
      )

      const session = await agent.mdoc.getVerificationSessionById(verificationSessionId)
      expect(session.state).toBe(MdocVerificationSessionState.Error)
    })

    test('a requested element marked optional may be left out', async () => {
      const { verificationSessionId, response } = await createResponseToOtherDeviceRequest({
        docRequests: [
          {
            docType,
            nameSpaces: { [nameSpace]: { family_name: true, birth_date: { intentToRetain: false, optional: true } } },
          },
        ],
      })

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(result.verificationSession.state).toBe(MdocVerificationSessionState.ResponseVerified)
      expect(result.deviceRequestMatch.success).toBe(true)
      expect(matchedDocRequests(result.deviceRequestMatch)[0].validDocuments[0].claims).toMatchObject({
        success: true,
        validClaims: [{ elementIdentifier: 'family_name', success: true }],
        failedClaims: [{ elementIdentifier: 'birth_date', success: false, optional: true, failure: 'notDisclosed' }],
      })
    })

    test('the element options are stored per doc request, and only intent to retain is sent', async () => {
      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [
          {
            docType,
            nameSpaces: {
              [nameSpace]: { family_name: true, birth_date: { intentToRetain: false, optional: true } },
              'com.example.device': { session_id: { intentToRetain: false, source: 'deviceSigned' } },
            },
          },
          { docType: otherDocType, nameSpaces: { [otherNameSpace]: { given_name: false } } },
        ],
      })

      const expectedDefinition = {
        docRequests: [
          {
            docType,
            nameSpaces: {
              [nameSpace]: {
                family_name: { intentToRetain: true },
                birth_date: { intentToRetain: false, optional: true },
              },
              'com.example.device': { session_id: { intentToRetain: false, source: 'deviceSigned' } },
            },
          },
          { docType: otherDocType, nameSpaces: { [otherNameSpace]: { given_name: { intentToRetain: false } } } },
        ],
      }
      expect(verificationSession.deviceRequestDefinition).toEqual(expectedDefinition)

      const stored = await agent.mdoc.getVerificationSessionById(verificationSession.id)
      expect(stored.deviceRequestDefinition).toEqual(expectedDefinition)

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      expect(resolved.docRequests.map(({ nameSpaces }) => nameSpaces)).toEqual([
        {
          [nameSpace]: { family_name: true, birth_date: false },
          'com.example.device': { session_id: false },
        },
        { [otherNameSpace]: { given_name: false } },
      ])
    })

    test('the wallet can leave out an element the verifier marked optional', async () => {
      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [
          {
            docType,
            nameSpaces: { [nameSpace]: { family_name: true, birth_date: { intentToRetain: false, optional: true } } },
          },
        ],
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: resolved,
        credentials: [{ docRequestIndex: 0, record: mdocRecord, elements: { [nameSpace]: ['family_name'] } }],
      })

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(result.deviceResponse.issuerClaims).toEqual({ [docType]: { [nameSpace]: { family_name: 'Doe' } } })
      expect(matchedDocRequests(result.deviceRequestMatch)[0].validDocuments[0].claims).toMatchObject({
        success: true,
        validClaims: [{ elementIdentifier: 'family_name', success: true }],
        failedClaims: [{ elementIdentifier: 'birth_date', success: false, optional: true }],
      })
    })

    test('a response that does not answer every doc request does not verify', async () => {
      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [
          { docType, nameSpaces: { [nameSpace]: { family_name: true } } },
          { docType: otherDocType, nameSpaces: { [otherNameSpace]: { given_name: true } } },
        ],
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: resolved,
        credentials: [{ docRequestIndex: 0, record: mdocRecord }],
      })

      const verification = agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      await expect(verification).rejects.toThrow(MdocDeviceRequestNotSatisfiedError)
      await expect(verification).rejects.toThrow(
        `Device response does not contain a document with docType '${otherDocType}'`
      )
    })
  })

  // A device request with more than one doc request and no use cases does not say whether it asks for
  // all of them or for any one of them, so both sides have to opt in to the same interpretation.
  describe('doc requests as alternatives', () => {
    const unknownDocType = 'com.example.unknown.1'
    const otherUnknownDocType = 'com.example.unknown.2'

    const createAlternativesSession = (docTypes: [string, string]) =>
      agent.mdoc.createDcApiVerificationSession({
        docRequests: docTypes.map((requestedDocType) => ({
          docType: requestedDocType,
          nameSpaces: { [nameSpace]: { family_name: true } },
        })),
        treatAmbiguousMultipleDocRequestsAsAlternatives: true,
      })

    test('selecting credentials answers the first alternative that can be answered', async () => {
      const { verificationSession, request } = await createAlternativesSession([unknownDocType, docType])

      const resolved = await agent.mdoc.resolveDcApiRequest({
        request,
        origin,
        treatAmbiguousMultipleDocRequestsAsAlternatives: true,
      })
      const selected = agent.mdoc.selectCredentialsForRequest(resolved)

      expect(selected.credentials.map(({ docRequestIndex }) => docRequestIndex)).toEqual([1])

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response: await agent.mdoc.createDcApiResponse(selected),
        origin,
        trustedCertificates: [issuerCertificatePem],
      })
      expect(result.deviceRequestMatch.success).toBe(true)
    })

    test('a response that only answers one of the alternatives verifies', async () => {
      const { verificationSession, request } = await createAlternativesSession([unknownDocType, docType])

      expect(verificationSession.deviceRequestDefinition.treatAmbiguousMultipleDocRequestsAsAlternatives).toBe(true)

      const resolved = await agent.mdoc.resolveDcApiRequest({
        request,
        origin,
        treatAmbiguousMultipleDocRequestsAsAlternatives: true,
      })

      // The doc requests that cannot be answered are kept, so the wallet can see which alternative it can answer
      expect(resolved).toMatchObject({ success: true, useCasesSource: 'eachDocRequest' })
      expect(resolved.docRequests.map(({ docType: requested, success }) => ({ docType: requested, success }))).toEqual([
        { docType: unknownDocType, success: false },
        { docType, success: true },
      ])

      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: resolved,
        credentials: [{ docRequestIndex: 1, record: mdocRecord }],
      })

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(result.verificationSession.state).toBe(MdocVerificationSessionState.ResponseVerified)
      expect(result.deviceRequestMatch).toMatchObject({
        success: true,
        useCasesSource: 'eachDocRequest',
        unrequestedDocuments: [],
        docRequests: [
          { docRequestIndex: 0, docType: unknownDocType, success: false },
          { docRequestIndex: 1, docType, success: true },
        ],
      })
    })

    test('the same response does not verify against a session that did not request alternatives', async () => {
      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [
          { docType: unknownDocType, nameSpaces: { [nameSpace]: { family_name: true } } },
          { docType, nameSpaces: { [nameSpace]: { family_name: true } } },
        ],
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      expect(resolved).toMatchObject({ success: false, useCasesSource: 'allDocRequests' })

      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: resolved,
        credentials: [{ docRequestIndex: 1, record: mdocRecord }],
      })

      const verification = agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      await expect(verification).rejects.toThrow(MdocDeviceRequestNotSatisfiedError)
      await expect(verification).rejects.toThrow(
        `Device response does not contain a document with docType '${unknownDocType}'`
      )
    })

    test('a response that answers none of the alternatives does not verify', async () => {
      const { verificationSession, request } = await createAlternativesSession([unknownDocType, otherUnknownDocType])

      const resolved = await agent.mdoc.resolveDcApiRequest({
        request,
        origin,
        treatAmbiguousMultipleDocRequestsAsAlternatives: true,
      })
      expect(resolved).toMatchObject({ success: false, useCasesSource: 'eachDocRequest' })

      // Answer another device request, so the response carries a document neither alternative asked for
      const { request: otherRequest } = await createSession()
      const otherResolved = await agent.mdoc.resolveDcApiRequest({
        request: { ...request, deviceRequest: otherRequest.deviceRequest },
        origin,
      })
      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: otherResolved,
        credentials: [{ docRequestIndex: 0, record: mdocRecord }],
      })

      const verification = agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      await expect(verification).rejects.toThrow(MdocDeviceRequestNotSatisfiedError)
      await expect(verification).rejects.toThrow(
        `Doc request 0: Device response does not contain a document with docType '${unknownDocType}'`
      )
      await expect(verification).rejects.toThrow(
        `Doc request 1: Device response does not contain a document with docType '${otherUnknownDocType}'`
      )
    })

    test('a single doc request is never treated as an alternative', async () => {
      const { request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [{ docType: unknownDocType, nameSpaces: { [nameSpace]: { family_name: true } } }],
        treatAmbiguousMultipleDocRequestsAsAlternatives: true,
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({
        request,
        origin,
        treatAmbiguousMultipleDocRequestsAsAlternatives: true,
      })

      expect(resolved).toMatchObject({ success: false, useCasesSource: 'allDocRequests' })
    })
  })

  describe('use cases', () => {
    const unknownDocType = 'com.example.unknown.1'

    // An unknown document or an mDL, and optionally a photo ID
    const createUseCasesSession = () =>
      agent.mdoc.createDcApiVerificationSession({
        docRequests: [
          { docType: unknownDocType, nameSpaces: { [nameSpace]: { family_name: true } } },
          { docType, nameSpaces: { [nameSpace]: { family_name: true } } },
          { docType: otherDocType, nameSpaces: { [otherNameSpace]: { given_name: true } } },
        ],
        deviceRequestInfo: {
          useCases: [
            { mandatory: true, documentSets: [[0], [1]], purposeHints: { 'org.example.purpose': 1 } },
            { mandatory: false, documentSets: [[2]] },
          ],
        },
      })

    test('a response that answers a document set of each use case verifies', async () => {
      const { verificationSession, request } = await createUseCasesSession()

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

      expect(resolved).toMatchObject({
        success: true,
        useCasesSource: 'deviceRequestInfo',
        useCases: [
          {
            useCaseIndex: 0,
            mandatory: true,
            purposeHints: { 'org.example.purpose': 1 },
            success: true,
            documentSets: [[0], [1]],
            matchingDocumentSets: [[1]],
          },
          { useCaseIndex: 1, mandatory: false, success: true, documentSets: [[2]], matchingDocumentSets: [[2]] },
        ],
      })
      expect(resolved.docRequests.map(({ success }) => success)).toEqual([false, true, true])

      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: resolved,
        credentials: [
          { docRequestIndex: 1, record: mdocRecord },
          { docRequestIndex: 2, record: otherMdocRecord },
        ],
      })

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(result.deviceRequestMatch).toMatchObject({
        success: true,
        useCasesSource: 'deviceRequestInfo',
        useCases: [
          { useCaseIndex: 0, success: true, matchingDocumentSets: [[1]] },
          { useCaseIndex: 1, success: true, matchingDocumentSets: [[2]] },
        ],
      })
    })

    test('selecting credentials answers the mandatory use case with its first matching document set', async () => {
      const { verificationSession, request } = await createUseCasesSession()

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      const selected = agent.mdoc.selectCredentialsForRequest(resolved)

      // The optional use case is left out, as with optional credential sets in DCQL
      expect(selected.credentials.map(({ docRequestIndex, record }) => ({ docRequestIndex, id: record.id }))).toEqual([
        { docRequestIndex: 1, id: mdocRecord.id },
      ])

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response: await agent.mdoc.createDcApiResponse(selected),
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(result.deviceRequestMatch).toMatchObject({
        success: true,
        useCases: [{ success: true }, { success: false }],
      })
    })

    test('a single mdoc can answer several doc requests of its docType', async () => {
      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [
          { docType, nameSpaces: { [nameSpace]: { family_name: true } } },
          { docType, nameSpaces: { [nameSpace]: { given_name: true } } },
        ],
        deviceRequestInfo: { useCases: [{ mandatory: true, documentSets: [[0, 1]] }] },
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

      // Selecting answers both doc requests with the one credential, as a single document
      const selected = agent.mdoc.selectCredentialsForRequest(resolved)
      expect(selected.credentials).toEqual([
        {
          docRequestIndex: [0, 1],
          record: expect.objectContaining({ id: mdocRecord.id }),
          useMode: CredentialMultiInstanceUseMode.NewOrFirst,
        },
      ])

      const response = await agent.mdoc.createDcApiResponse(selected)

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      // One document, disclosing the elements of both doc requests
      expect(result.deviceResponse.deviceResponse.documents).toHaveLength(1)
      expect(result.deviceResponse.issuerClaims).toEqual({
        [docType]: { [nameSpace]: { family_name: 'Doe', given_name: 'John' } },
      })
      expect(result.deviceRequestMatch).toMatchObject({ success: true, useCases: [{ success: true }] })
    })

    test('a credential answers doc requests with different alternatives for an element with a document each', async () => {
      const alternativesFor = (alternativeElement: string) =>
        ({
          alternativeDataElements: [
            { requestedElement: [nameSpace, 'portrait'], alternativeElementSets: [[[nameSpace, alternativeElement]]] },
          ],
        }) satisfies MdocDocRequestInfo

      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [
          { docType, nameSpaces: { [nameSpace]: { portrait: false } }, requestInfo: alternativesFor('birth_date') },
          { docType, nameSpaces: { [nameSpace]: { portrait: false } }, requestInfo: alternativesFor('family_name') },
        ],
        deviceRequestInfo: { useCases: [{ mandatory: true, documentSets: [[0, 1]] }] },
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      const selected = agent.mdoc.selectCredentialsForRequest(resolved)

      expect(selected.credentials).toMatchObject([
        { docRequestIndex: 0, record: { id: mdocRecord.id }, alternatives: { [nameSpace]: { portrait: 0 } } },
        { docRequestIndex: 1, record: { id: mdocRecord.id }, alternatives: { [nameSpace]: { portrait: 0 } } },
      ])

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response: await agent.mdoc.createDcApiResponse(selected),
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(result.deviceResponse.deviceResponse.documents).toHaveLength(2)
      expect(result.deviceRequestMatch.success).toBe(true)
    })

    test('a response that leaves the mandatory use case unanswered does not verify', async () => {
      const { verificationSession, request } = await createUseCasesSession()

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      await expect(
        agent.mdoc.createDcApiResponse({
          resolvedRequest: resolved,
          credentials: [{ docRequestIndex: 2, record: otherMdocRecord }],
        })
      ).rejects.toThrow(UnsatisfiedDeviceRequestError)

      // Answer another device request, so the wallet does not stop the response
      const { request: otherRequest } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [{ docType: otherDocType, nameSpaces: { [otherNameSpace]: { given_name: true } } }],
      })
      const otherResolved = await agent.mdoc.resolveDcApiRequest({
        request: { ...request, deviceRequest: otherRequest.deviceRequest },
        origin,
      })
      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: otherResolved,
        credentials: [{ docRequestIndex: 0, record: otherMdocRecord }],
      })

      await expect(
        agent.mdoc.verifyDcApiResponse({
          verificationSessionId: verificationSession.id,
          response,
          origin,
          trustedCertificates: [issuerCertificatePem],
        })
      ).rejects.toThrow(MdocDeviceRequestNotSatisfiedError)
    })

    test('treating doc requests as alternatives is ignored when use cases are passed', async () => {
      const { request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [
          { docType, nameSpaces: { [nameSpace]: { family_name: true } } },
          { docType: otherDocType, nameSpaces: { [otherNameSpace]: { given_name: true } } },
        ],
        deviceRequestInfo: { useCases: [{ mandatory: true, documentSets: [[0], [1]] }] },
        treatAmbiguousMultipleDocRequestsAsAlternatives: true,
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

      expect(resolved.useCases).toMatchObject([{ mandatory: true, documentSets: [[0], [1]] }])
    })
  })

  describe('doc request info', () => {
    test('a requested element can be answered by an alternative set the wallet chooses', async () => {
      const requestInfo = {
        alternativeDataElements: [
          {
            requestedElement: [nameSpace, 'portrait'],
            alternativeElementSets: [[[nameSpace, 'birth_date']]],
          },
        ],
      } satisfies MdocDocRequestInfo

      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [{ docType, nameSpaces: { [nameSpace]: { family_name: true, portrait: false } }, requestInfo }],
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      assertEveryDocRequestSatisfied(resolved)

      expect(resolved.docRequests[0].requestInfo).toEqual(requestInfo)
      expect(resolved.docRequests[0].validCredentials[0].claims.validClaims[1]).toMatchObject({
        elementIdentifier: 'portrait',
        options: [
          {
            alternativeElementSetIndex: 0,
            elements: [{ namespace: nameSpace, elementIdentifier: 'birth_date', elementValue: '1990-01-01' }],
          },
        ],
      })

      // An alternative set is only disclosed when the wallet chooses it
      await expect(
        agent.mdoc.createDcApiResponse({
          resolvedRequest: resolved,
          credentials: [{ docRequestIndex: 0, record: mdocRecord }],
        })
      ).rejects.toThrow("Element 'portrait'")

      // Selecting chooses the alternative set, as the mdoc has no portrait
      const selected = agent.mdoc.selectCredentialsForRequest(resolved)
      expect(selected.credentials).toEqual([
        {
          docRequestIndex: 0,
          record: expect.objectContaining({ id: mdocRecord.id }),
          useMode: CredentialMultiInstanceUseMode.NewOrFirst,
          alternatives: { [nameSpace]: { portrait: 0 } },
        },
      ])

      const response = await agent.mdoc.createDcApiResponse(selected)

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(result.deviceResponse.issuerClaims).toEqual({
        [docType]: { [nameSpace]: { family_name: 'Doe', birth_date: '1990-01-01' } },
      })
      expect(matchedDocRequests(result.deviceRequestMatch)[0].validDocuments[0].claims).toMatchObject({
        success: true,
        unrequestedClaims: [],
      })
    })

    describe('issuer identifiers', () => {
      const issuerDocType = 'com.example.issuer.1'
      let keyIdentifiedIssuerCertificate: X509Certificate
      let keyIdentifiedMdocRecord: MdocRecord

      beforeAll(async () => {
        const issuerKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })
        const holderKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

        keyIdentifiedIssuerCertificate = await X509Service.createCertificate(agent.context, {
          issuer: 'CN=credo-issuer, C=NL',
          authorityKey: PublicJwk.fromPublicJwk(issuerKey.publicJwk),
          validity: { notBefore: new Date(Date.now() - 60_000), notAfter: getNextMonth() },
          extensions: { authorityKeyIdentifier: { include: true } },
        })

        const mdoc = await Mdoc.sign(agent.context, {
          docType: issuerDocType,
          validityInfo: { validUntil: getNextMonth() },
          holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
          namespaces: { [nameSpace]: { family_name: 'Doe' } },
          issuerCertificate: keyIdentifiedIssuerCertificate,
        })
        mdoc.deviceKeyId = holderKey.keyId

        keyIdentifiedMdocRecord = await agent.mdoc.store({ record: MdocRecord.fromMdoc(mdoc) })
      })

      const createIssuerSession = (issuerIdentifiers: string[]) =>
        agent.mdoc.createDcApiVerificationSession({
          docRequests: [
            {
              docType: issuerDocType,
              nameSpaces: { [nameSpace]: { family_name: true } },
              requestInfo: { issuerIdentifiers },
            },
          ],
        })

      test('an mdoc of an accepted issuer matches and verifies', async () => {
        const authorityKeyIdentifier = keyIdentifiedIssuerCertificate.authorityKeyIdentifier
        if (!authorityKeyIdentifier) throw new Error('Expected the certificate to have an authority key identifier')

        const { verificationSession, request } = await createIssuerSession([authorityKeyIdentifier])

        const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
        assertEveryDocRequestSatisfied(resolved)
        expect(resolved.docRequests[0].validCredentials[0]).toMatchObject({
          record: { id: keyIdentifiedMdocRecord.id },
          issuer: { success: true },
        })

        const response = await agent.mdoc.createDcApiResponse({
          resolvedRequest: resolved,
          credentials: [{ docRequestIndex: 0, record: keyIdentifiedMdocRecord }],
        })

        // The issuer is matched against the certificate chain the document was verified with
        const result = await agent.mdoc.verifyDcApiResponse({
          verificationSessionId: verificationSession.id,
          response,
          origin,
          trustedCertificates: [keyIdentifiedIssuerCertificate.toString('pem')],
        })

        expect(matchedDocRequests(result.deviceRequestMatch)[0].validDocuments[0]).toMatchObject({
          issuer: { success: true },
        })
      })

      test('an mdoc of another issuer does not match or verify', async () => {
        const { verificationSession, request } = await createIssuerSession(['00'.repeat(20)])

        const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
        expect(resolved.success).toBe(false)
        expect(resolved.docRequests[0].failedCredentials).toMatchObject([
          { record: { id: keyIdentifiedMdocRecord.id }, issuer: { success: false } },
        ])

        // Answer another device request, so the wallet does not stop the response
        const { request: otherRequest } = await agent.mdoc.createDcApiVerificationSession({
          docRequests: [{ docType: issuerDocType, nameSpaces: { [nameSpace]: { family_name: true } } }],
        })
        const otherResolved = await agent.mdoc.resolveDcApiRequest({
          request: { ...request, deviceRequest: otherRequest.deviceRequest },
          origin,
        })
        const response = await agent.mdoc.createDcApiResponse({
          resolvedRequest: otherResolved,
          credentials: [{ docRequestIndex: 0, record: keyIdentifiedMdocRecord }],
        })

        await expect(
          agent.mdoc.verifyDcApiResponse({
            verificationSessionId: verificationSession.id,
            response,
            origin,
            trustedCertificates: [keyIdentifiedIssuerCertificate.toString('pem')],
          })
        ).rejects.toThrow(MdocDeviceRequestNotSatisfiedError)
      })
    })
  })

  describe('wallet and verifier apply the same matching rules', () => {
    const deviceDocType = 'com.example.device.1'
    const deviceNameSpace = 'com.example.device'
    let deviceMdocRecord: MdocRecord

    beforeAll(async () => {
      const holderKey = await agent.kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

      const mdoc = await Mdoc.sign(agent.context, {
        docType: deviceDocType,
        validityInfo: { validUntil: getNextMonth() },
        holderKey: PublicJwk.fromPublicJwk(holderKey.publicJwk),
        namespaces: { [nameSpace]: { family_name: 'Doe', age_over_21: true } },
        issuerCertificate,
        keyAuthorizations: { namespaces: [deviceNameSpace] },
      })
      mdoc.deviceKeyId = holderKey.keyId

      deviceMdocRecord = await agent.mdoc.store({ record: MdocRecord.fromMdoc(mdoc) })
    })

    test('an element the device key is authorized for is disclosed device signed', async () => {
      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [
          {
            docType: deviceDocType,
            nameSpaces: {
              [nameSpace]: { family_name: true },
              [deviceNameSpace]: { session_id: { intentToRetain: false, source: 'deviceSigned' } },
            },
          },
        ],
      })

      // The element is not issuer signed, so without its value no stored mdoc can answer it
      const unresolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      expect(unresolved.success).toBe(false)
      expect(unresolved.docRequests[0].failedCredentials[0].claims.failedClaims).toMatchObject([
        { namespace: deviceNameSpace, elementIdentifier: 'session_id', failure: 'notDisclosed' },
      ])

      const resolved = await agent.mdoc.resolveDcApiRequest({
        request,
        origin,
        deviceNameSpaces: { [deviceNameSpace]: { session_id: 'abc' } },
      })

      // The element is not issuer signed, but the device key is authorized for it
      assertEveryDocRequestSatisfied(resolved)
      expect(resolved.docRequests[0].validCredentials).toHaveLength(1)
      expect(resolved.docRequests[0].validCredentials[0].claims.validClaims).toMatchObject([
        { namespace: nameSpace, elementIdentifier: 'family_name', elementValue: 'Doe', source: 'issuerSigned' },
        {
          namespace: deviceNameSpace,
          elementIdentifier: 'session_id',
          elementValue: 'abc',
          source: 'deviceSigned',
        },
      ])

      // Without the value the element cannot be disclosed.
      await expect(
        agent.mdoc.createDcApiResponse({
          resolvedRequest: resolved,
          credentials: [{ docRequestIndex: 0, record: deviceMdocRecord }],
        })
      ).rejects.toThrow(
        "Element 'session_id' in namespace 'com.example.device' is not issuer-signed in the credential, so it has to be disclosed device-signed"
      )

      // Selecting provides the device signed values the request was resolved with
      const selected = agent.mdoc.selectCredentialsForRequest(resolved)
      expect(selected.credentials).toEqual([
        {
          docRequestIndex: 0,
          record: expect.objectContaining({ id: deviceMdocRecord.id }),
          useMode: CredentialMultiInstanceUseMode.NewOrFirst,
          deviceNameSpaces: { [deviceNameSpace]: { session_id: 'abc' } },
        },
      ])

      const response = await agent.mdoc.createDcApiResponse(selected)

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(result.deviceResponse.deviceClaims).toEqual({
        [deviceDocType]: { [deviceNameSpace]: { session_id: 'abc' } },
      })
      expect(matchedDocRequests(result.deviceRequestMatch)[0].validDocuments[0].claims.validClaims[1]).toMatchObject({
        success: true,
        elementIdentifier: 'session_id',
        elementValue: 'abc',
        source: 'deviceSigned',
      })
    })

    test('an age_over_NN request is answered with the age attestation the mdoc has', async () => {
      const { verificationSession, request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [{ docType: deviceDocType, nameSpaces: { [nameSpace]: { age_over_18: false } } }],
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      assertEveryDocRequestSatisfied(resolved)

      expect(resolved.docRequests[0].validCredentials[0].claims.validClaims).toMatchObject([
        { elementIdentifier: 'age_over_18', disclosedElementIdentifier: 'age_over_21', elementValue: true },
      ])

      const response = await agent.mdoc.createDcApiResponse({
        resolvedRequest: resolved,
        credentials: [{ docRequestIndex: 0, record: deviceMdocRecord }],
      })

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response,
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(matchedDocRequests(result.deviceRequestMatch)[0].validDocuments[0].claims.validClaims[0]).toMatchObject({
        success: true,
        elementIdentifier: 'age_over_18',
        disclosedElementIdentifier: 'age_over_21',
      })
    })
  })

  describe('selecting credentials', () => {
    test('the selected credentials are the input to create a response', async () => {
      const { verificationSession, request } = await createSession()

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      const selected = agent.mdoc.selectCredentialsForRequest(resolved)

      expect(selected).toEqual({
        resolvedRequest: resolved,
        credentials: [
          {
            docRequestIndex: 0,
            record: expect.objectContaining({ id: mdocRecord.id }),
            useMode: CredentialMultiInstanceUseMode.NewOrFirst,
          },
        ],
      })

      const result = await agent.mdoc.verifyDcApiResponse({
        verificationSessionId: verificationSession.id,
        response: await agent.mdoc.createDcApiResponse(selected),
        origin,
        trustedCertificates: [issuerCertificatePem],
      })

      expect(result.verificationSession.state).toBe(MdocVerificationSessionState.ResponseVerified)
    })

    test('a request that cannot be satisfied has nothing to select', async () => {
      const { request } = await agent.mdoc.createDcApiVerificationSession({
        docRequests: [{ docType, nameSpaces: { [nameSpace]: { family_name: true, portrait: false } } }],
      })

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

      expect(() => agent.mdoc.selectCredentialsForRequest(resolved)).toThrow(
        'Cannot select the credentials for the request if the request cannot be satisfied'
      )
    })

    test('only credentials that can be used with the use mode are selected', async () => {
      const { request } = await createSession()

      const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })
      await agent.mdoc.createDcApiResponse(agent.mdoc.selectCredentialsForRequest(resolved))

      // The stored mdoc has a single instance, which is now used, so it can be used again but not as a new one
      expect(() =>
        agent.mdoc.selectCredentialsForRequest(resolved, { useMode: CredentialMultiInstanceUseMode.New })
      ).toThrow('Unable to select credentials for use case 0')
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
    expect(resolved.docRequests[0].validCredentials.map(({ record }) => record.id)).toEqual([mdocRecord.id])
    expect(resolved.docRequests[0].failedCredentials).toEqual([])
  })

  test('an mdoc of the requested doctype that is missing claims is returned with the missing claims', async () => {
    const { request } = await agent.mdoc.createDcApiVerificationSession({
      docRequests: [{ docType, nameSpaces: { [nameSpace]: { family_name: true, portrait: false } } }],
    })

    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

    expect(resolved.success).toBe(false)
    expect(resolved.docRequests[0]).toMatchObject({ success: false, validCredentials: [] })
    expect(resolved.docRequests[0].failedCredentials).toHaveLength(1)

    const [credential] = resolved.docRequests[0].failedCredentials
    expect(credential.record.id).toBe(mdocRecord.id)
    expect(credential).toMatchObject({
      success: false,
      docType: { success: true },
      claims: {
        success: false,
        validClaims: [{ elementIdentifier: 'family_name' }],
        failedClaims: [{ namespace: nameSpace, elementIdentifier: 'portrait', failure: 'notDisclosed' }],
      },
    })
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
    assertEveryDocRequestSatisfied(resolved)
    expect(resolved.docRequests[0].validCredentials.map(({ record }) => record.id)).toEqual([mdocRecord.id])
    expect(resolved.docRequests[1].validCredentials.map(({ record }) => record.id)).toEqual([otherMdocRecord.id])
    expect(resolved.docRequests[1].validCredentials[0].claims.validClaims).toMatchObject([
      { namespace: otherNameSpace, elementIdentifier: 'given_name', elementValue: 'John' },
    ])

    // Each mdoc is matched against both doc requests, and fails the other one on its doctype
    expect(resolved.docRequests[0].failedCredentials).toMatchObject([
      { record: { id: otherMdocRecord.id }, docType: { success: false, docType: otherDocType } },
    ])
  })

  test('a request for an unknown doctype has no matches', async () => {
    const { request } = await agent.mdoc.createDcApiVerificationSession({
      docRequests: [{ docType: 'com.example.unknown', nameSpaces: { 'com.example': { family_name: true } } }],
    })

    const resolved = await agent.mdoc.resolveDcApiRequest({ request, origin })

    expect(resolved.docRequests[0]).toMatchObject({ success: false, validCredentials: [], failedCredentials: [] })
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
