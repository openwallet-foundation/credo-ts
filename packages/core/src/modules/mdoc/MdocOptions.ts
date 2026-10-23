import type {
  ClaimMatch,
  CredentialMatchFailure,
  CredentialMatchSuccess,
  DeviceRequestMatchResult,
  IsoMdocDcApiRequest,
  IsoMdocDcApiResponse,
  UseCaseMatch,
  UseCasesSource,
  ValidityInfoOptions,
} from '@owf/mdoc'
import type { DcqlQuery } from 'dcql'
import type { NonEmptyArray } from '../../types'
import type { CredentialMultiInstanceUseMode } from '../../utils/credentialUseTypes'
import type { DifPresentationExchangeDefinition } from '../dif-presentation-exchange'
import { PublicJwk } from '../kms'
import type { EncodedX509Certificate, X509Certificate, X509VerificationTrustedCertificates } from '../x509'
import { Mdoc } from './Mdoc'
import { MdocRecord } from './repository'

export { DateOnly } from '@owf/mdoc'

export type MdocNameSpaces = Record<string, Record<string, unknown>>

export interface MdocStoreOptions {
  record: MdocRecord
}

export type MdocVerifyOptions = {
  trustedCertificates?: EncodedX509Certificate[] | Array<X509VerificationTrustedCertificates>
  now?: Date
}

export type MdocDeleteVerificationSessionOptions = {
  /**
   * Also delete the ephemeral session key created for the session. The key is not deleted at any
   * other point, so disabling this leaves it in the key store.
   *
   * @default true
   */
  deleteAssociatedKey?: boolean
}

export type MdocOpenId4VpSessionTranscriptOptions = {
  type: 'openId4Vp'
  responseUri: string
  clientId: string
  verifierGeneratedNonce: string
  encryptionJwk?: PublicJwk
}

export type MdocOpenId4VpDraft18SessionTranscriptOptions = {
  type: 'openId4VpDraft18'
  responseUri: string
  clientId: string
  verifierGeneratedNonce: string
  mdocGeneratedNonce: string
}

export type MdocSessionTranscriptByteOptions = {
  type: 'sessionTranscriptBytes'
  sessionTranscriptBytes: Uint8Array
}

export type MdocOpenId4VpDcApiSessionTranscriptOptions = {
  type: 'openId4VpDcApi'
  origin: string
  verifierGeneratedNonce: string
  encryptionJwk?: PublicJwk
}

export type MdocOpenId4VpDcApiDraft24SessionTranscriptOptions = {
  type: 'openId4VpDcApiDraft24'
  clientId: string
  origin: string
  verifierGeneratedNonce: string
}

export type MdocSessionTranscriptOptions =
  | MdocOpenId4VpSessionTranscriptOptions
  | MdocOpenId4VpDraft18SessionTranscriptOptions
  | MdocSessionTranscriptByteOptions
  | MdocOpenId4VpDcApiSessionTranscriptOptions
  | MdocOpenId4VpDcApiDraft24SessionTranscriptOptions

export type MdocDocumentRequest = {
  docType: string
  nameSpaces: Record<string, Record<string, boolean>>
}

export type MdocDeviceResponseOptions = {
  mdocs: [Mdoc, ...Mdoc[]]
  documentRequests: MdocDocumentRequest[]
  deviceNameSpaces?: MdocNameSpaces
  sessionTranscriptOptions: MdocSessionTranscriptOptions
}

export type MdocDeviceResponsePresentationDefinitionOptions = {
  mdocs: [Mdoc, ...Mdoc[]]
  presentationDefinition: DifPresentationExchangeDefinition
  deviceNameSpaces?: MdocNameSpaces
  sessionTranscriptOptions: MdocSessionTranscriptOptions
}

/**
 * @deprecated only used by the deprecated `MdocDeviceResponse.createDeviceResponseWithDcqlQuery`.
 */
export type MdocDeviceResponseDcqlQueryOptions = {
  mdocs: [Mdoc, ...Mdoc[]]
  dcqlQuery: DcqlQuery
  deviceNameSpaces?: MdocNameSpaces
  sessionTranscriptOptions: MdocSessionTranscriptOptions
}

export type MdocDeviceResponseVerifyOptions = {
  trustedCertificates?: EncodedX509Certificate[] | X509VerificationTrustedCertificates[]
  sessionTranscriptOptions: MdocSessionTranscriptOptions
  /**
   * The base64Url-encoded device response string.
   */
  deviceResponse: string
  now?: Date
}

export type MdocDeviceResponseVerifyResult = {
  /**
   * The verification result of each document in the device response, in response order.
   */
  documents: Array<{
    /**
     * Index into the documents of the device response of the document this result is about.
     */
    documentIndex: number

    /**
     * The verified document.
     */
    mdoc: Mdoc

    /**
     * The certificate chain the issuer signature of the document was verified with, leaf first and
     * the trusted certificate last.
     */
    trustedIssuanceChain?: X509Certificate[]
  }>
}

/**
 * Request payload for the ISO 18013-7 Annex C `org-iso-mdoc` DC API protocol. Both members are
 * base64url-no-pad encoded CBOR.
 */
export type MdocDcApiRequest = IsoMdocDcApiRequest

/**
 * Response payload for the ISO 18013-7 Annex C `org-iso-mdoc` DC API protocol.
 */
export type MdocDcApiResponse = IsoMdocDcApiResponse

/**
 * Where a requested element may be disclosed from. Device signed elements are asserted by the mdoc
 * itself rather than by the issuer, and can only be disclosed when the key authorizations in the MSO
 * authorize the device key for them.
 */
export type MdocElementSource = 'issuerSigned' | 'deviceSigned' | 'any'

/**
 * A requested element as the verifier defined it. Only `intentToRetain` is sent to the wallet; the
 * other members are not part of the device request and only apply when matching the response.
 */
export type MdocRequestedElement = {
  intentToRetain: boolean

  /**
   * Whether the response may leave this element out without failing the match.
   *
   * @default false
   */
  optional?: boolean

  /**
   * Where the element must be disclosed from.
   *
   * @default 'issuerSigned'
   */
  source?: MdocElementSource
}

/**
 * An element of a doc request, as namespace and element identifier.
 */
export type MdocElementReference = [nameSpace: string, elementIdentifier: string]

/**
 * The request information of a doc request (`DocRequestInfo` of ISO/IEC TS 23220-4 7.2.1.3.2, taken
 * up by the second edition of ISO/IEC 18013-5). Sent to the wallet as part of the doc request.
 */
export type MdocDocRequestInfo = {
  /**
   * Elements that may be disclosed in place of a requested element. Each alternative set answers
   * the requested element on its own, in order of preference. The requested element itself is still
   * preferred over its alternatives.
   */
  alternativeDataElements?: Array<{
    requestedElement: MdocElementReference
    alternativeElementSets: Array<Array<MdocElementReference>>
  }>

  /**
   * Hex encoded key identifiers of the issuers the doc request accepts, for instance the
   * `subjectKeyIdentifier` of a trusted IACA certificate. An mdoc only satisfies the doc request when
   * one of them is the authority key identifier of a certificate in its chain. The verifier matches
   * them against the certificate chain it validated, never against the unprotected `x5chain`.
   */
  issuerIdentifiers?: string[]

  /**
   * Whether the doc request has to be answered by a single document.
   */
  uniqueDocSetRequired?: boolean

  /**
   * The largest unencrypted device response, in bytes, the verifier accepts.
   */
  maximumResponseSize?: number
}

/**
 * A use case of a device request (`UseCase` of ISO/IEC TS 23220-4 7.2.1.3.4, taken up by the second
 * edition of ISO/IEC 18013-5): which doc requests answer what the verifier asks for.
 */
export type MdocUseCase = {
  /**
   * Whether the use case has to be satisfied for the device request to be.
   */
  mandatory: boolean

  /**
   * The document sets that answer the use case, each a list of indexes into the doc requests. The
   * response has to answer every doc request of exactly one of them.
   */
  documentSets: number[][]

  /**
   * Why the verifier asks, per purpose controller, as codes of a registry a profile defines.
   */
  purposeHints?: Record<string, number>
}

/**
 * The request information of a device request (`DeviceRequestInfo` of ISO/IEC TS 23220-4 7.2.1.3.4,
 * taken up by the second edition of ISO/IEC 18013-5).
 */
export type MdocDeviceRequestInfo = {
  useCases?: MdocUseCase[]
}

/**
 * A doc request as the verifier defined it.
 */
export type MdocDocRequestDefinition = {
  docType: string

  /**
   * Requested elements per namespace.
   */
  nameSpaces: Record<string, Record<string, MdocRequestedElement>>
}

/**
 * The device request as the verifier defined it, with the options that only apply when matching the
 * response. The request information and use cases are part of the device request itself, which is
 * stored on the verification session as well.
 */
export type MdocDeviceRequestDefinition = {
  /**
   * The doc requests in request order, so the index of a doc request here is its index in the
   * device request.
   */
  docRequests: MdocDocRequestDefinition[]

  /**
   * Whether the doc requests are alternatives, of which the response only has to satisfy one. Not
   * part of the device request itself, and only applied when matching the response. Does not apply
   * when the device request has use cases.
   *
   * @default false
   */
  treatAmbiguousMultipleDocRequestsAsAlternatives?: boolean
}

/**
 * How a device response matches the device request, per doc request, per document and per check.
 */
export type MdocDeviceRequestMatch = DeviceRequestMatchResult

export type MdocDcApiDocRequest = {
  docType: string

  /**
   * Requested elements per namespace, mapped to their `intentToRetain` value. Pass an
   * {@link MdocRequestedElement} instead to also set how the element is matched in the response.
   */
  nameSpaces: Record<string, Record<string, boolean | MdocRequestedElement>>

  /**
   * Alternative elements, accepted issuers and the other request information of the doc request.
   * Sent in the doc request, and applied when the response is verified.
   */
  requestInfo?: MdocDocRequestInfo
}

export type MdocDcApiCreateVerificationSessionOptions = {
  /**
   * The documents to request. Without `deviceRequestInfo` the response has to satisfy every doc
   * request, which by default means that each requested element must be disclosed and issuer signed. Pass an
   * {@link MdocRequestedElement} for elements that may be left out, or that may (or must) be device
   * signed instead.
   *
   * Stored on the verification session, and applied when the response is verified.
   */
  docRequests: MdocDcApiDocRequest[]

  /**
   * The use cases of the device request, which say which doc requests the response has to answer:
   * every mandatory use case, and at least one use case, with exactly one of its document sets.
   *
   * Sets the device request version to `1.1`. Wallets that do not support use cases ignore them, and
   * read every doc request as requested.
   *
   * @example
   * Request a driving licence, or both a passport and a residence permit, and optionally a loyalty
   * card:
   *
   * ```ts
   * {
   *   useCases: [
   *     { mandatory: true, documentSets: [[0], [1, 2]] },
   *     { mandatory: false, documentSets: [[3]] },
   *   ],
   * }
   * ```
   */
  deviceRequestInfo?: MdocDeviceRequestInfo

  /**
   * A device request with more than one doc request and no use cases does not say whether it asks
   * for all of them, or for any one of them. By default the response has to satisfy every doc
   * request. Set this to accept the doc requests as alternatives instead, of which the response only
   * has to satisfy one, which is how the iOS DC API presents such a request. Use `deviceRequestInfo`
   * to state it in the request itself.
   *
   * Nothing is added to the request; this only changes how the response is matched, and is stored on
   * the verification session along with the doc requests. A wallet may still answer every doc
   * request.
   *
   * Ignored when `deviceRequestInfo` has use cases, as they already say how the doc requests relate.
   * Does not apply when only a single document is requested.
   *
   * @default false
   */
  treatAmbiguousMultipleDocRequestsAsAlternatives?: boolean

  /**
   * Sign each doc request with reader authentication. The certificate (or chain) must have a
   * publicJwk with a key id configured, so the KMS can sign with it.
   */
  readerAuth?: {
    certificate: X509Certificate | X509Certificate[]

    /**
     * The origin the signed request is created for. Reader authentication signs over the session
     * transcript, which binds a single origin, so a signed request can only be used against this
     * origin. Create one session per origin if you need more than one.
     */
    origin: string
  }

  /**
   * @default 300
   */
  expiresInSeconds?: number
}

export type MdocDcApiVerifyResponseOptions = {
  verificationSessionId: string

  /**
   * The `{ response }` payload received from the wallet.
   */
  response: MdocDcApiResponse

  /**
   * The origin the DC API call was made from. The origin is not carried in the request or the
   * response; it only enters the protocol as a preimage of the hash in the `DCAPIHandover`, so it
   * has to be supplied here to reconstruct the session transcript the response was encrypted to.
   *
   * A response from any other origin fails to decrypt, which is what makes a relayed response fail.
   *
   * If the session was created with `readerAuth`, this must be the same origin the request was
   * signed for: the reader signature covers the same session transcript, so a different origin
   * here cannot verify either.
   */
  origin: string

  trustedCertificates?: EncodedX509Certificate[] | X509VerificationTrustedCertificates[]
  now?: Date
}

export type MdocDcApiResolveRequestOptions = {
  request: MdocDcApiRequest

  /**
   * The origin as provided by the platform. Annex C C.5 requires the mdoc to abort when the DC API
   * did not provide one, so resolving without an origin is rejected.
   */
  origin: string

  /**
   * Trust anchors the reader certificate chain of each doc request is validated against.
   *
   * When omitted the trusted certificates are resolved the same way as for credential
   * verification: the global `getTrustedIssuersForVerification` callback first, and only if it
   * returns nothing the statically configured trusted certificates. If neither is configured,
   * resolving a reader authenticated request throws.
   *
   * Return the leaf certificate from the callback to trust a reader on the certificate it
   * presented itself, or an empty array to reject it.
   */
  trustedReaderCertificates?: Array<EncodedX509Certificate | X509Certificate>

  /**
   * Values the wallet can disclose device signed. A requested element that is not issuer signed in
   * a stored mdoc only matches when its value is provided here and the device key is authorized for
   * it in the MSO. Pass the same values in the `deviceNameSpaces` of the credential to
   * `createDcApiResponse`.
   */
  deviceNameSpaces?: MdocNameSpaces

  /**
   * Which mode to use for usage of the credential instances. Credential records that cannot
   * provide an instance for this mode are not returned as a match, as they cannot be used to
   * create a response.
   *
   * This only filters the matches. The mode a credential is actually used with is set per
   * credential when creating the response.
   *
   * @default {@link CredentialMultiInstanceUseMode.NewOrFirst}
   */
  useMode?: CredentialMultiInstanceUseMode

  /**
   * A device request with more than one doc request and no use cases does not say whether the
   * verifier asks for all of them, or for any one of them. By default the resolved request only
   * succeeds when the stored mdocs can satisfy every doc request. Set this to treat them as
   * alternatives instead, one optional use case per doc request, of which at least one has to be
   * satisfiable. That is how the iOS DC API presents such a request.
   *
   * The per doc request matching does not change, so a resolved request that succeeds this way can
   * still have failed doc requests. Check `useCases` on the resolved request, and only create a
   * response for the doc requests that succeeded.
   *
   * Does not apply to a request with a single doc request, or to a request with use cases.
   *
   * @default false
   */
  treatAmbiguousMultipleDocRequestsAsAlternatives?: boolean

  now?: Date
}

/**
 * How a single requested element is matched, the same on the wallet and the verifier side.
 */
export type MdocClaimMatch = ClaimMatch

/**
 * A stored mdoc that satisfies a doc request: every check passed. Uses the same rules and structure
 * as the match of a verifier.
 *
 * A valid claim with `source: 'deviceSigned'` is not issuer signed in the mdoc, but the device key is
 * authorized for it and its value was provided in the `deviceNameSpaces` the request was resolved
 * with: the same value has to be provided in the `deviceNameSpaces` of the credential when creating
 * the response.
 */
export type MdocValidCredential = Omit<CredentialMatchSuccess, 'credentialIndex'> & {
  record: MdocRecord
}

/**
 * A stored mdoc that does not satisfy a doc request, with per check what failed. An mdoc of the
 * requested docType that is missing requested claims has a successful `docType` check and its
 * `claims.failedClaims`.
 */
export type MdocFailedCredential = Omit<CredentialMatchFailure, 'credentialIndex'> & {
  record: MdocRecord
}

export type MdocCredentialMatch = MdocValidCredential | MdocFailedCredential

type MdocResolvedDocRequestBase = {
  docRequestIndex: number
  docType: string

  /**
   * Requested elements per namespace, mapped to their `intentToRetain` value.
   */
  nameSpaces: Record<string, Record<string, boolean>>

  /**
   * The request information of the doc request. Its alternative elements are listed per claim as
   * `options`, and a credential of an issuer it does not accept fails the `issuer` check.
   */
  requestInfo?: MdocDocRequestInfo

  /**
   * The reader authentication carried by the doc request, of which both the signature and the
   * trust of the certificate chain were verified. Reader auth is optional, so an absent
   * `readerAuth` means no signature was present — not that verification failed.
   */
  readerAuth?: {
    /**
     * The reader's certificate chain, leaf first. Empty when the reader auth carried no `x5chain`.
     */
    certificateChain: X509Certificate[]
  }

  /**
   * The stored mdocs that do not satisfy this doc request. Only mdocs of a doctype the request asks
   * for are matched, so an mdoc of another doc request's docType is here with a failed `docType`
   * check.
   */
  failedCredentials: MdocFailedCredential[]
}

/**
 * At least one stored mdoc satisfies the doc request.
 */
export type MdocResolvedDocRequestSuccess = MdocResolvedDocRequestBase & {
  success: true
  validCredentials: NonEmptyArray<MdocValidCredential>
}

/**
 * No stored mdoc satisfies the doc request.
 */
export type MdocResolvedDocRequestFailure = MdocResolvedDocRequestBase & {
  success: false
  validCredentials: []
}

export type MdocResolvedDocRequest = MdocResolvedDocRequestSuccess | MdocResolvedDocRequestFailure

/**
 * Whether the stored mdocs can satisfy a use case of the request, and with which document sets.
 * A response answers every doc request of exactly one document set of a use case.
 */
export type MdocResolvedUseCase = Omit<UseCaseMatch, 'purposeHints'> & {
  /**
   * The purpose hints of the use case, per purpose controller. Only use cases of the request have
   * them.
   */
  purposeHints?: Record<string, number>
}

/**
 * A device request matched against the stored mdocs, independent of how the request was received.
 *
 * The doc requests are matched by use case. When the request has none, every doc request is one
 * mandatory use case (`useCasesSource` is `'allDocRequests'`), or with
 * `treatAmbiguousMultipleDocRequestsAsAlternatives` each doc request is an optional one
 * (`'eachDocRequest'`).
 *
 * Checking `success` narrows the doc requests when `useCasesSource` is `'allDocRequests'`: every doc
 * request then has at least one valid credential. Otherwise a successful request can have failed doc
 * requests, and `matchingDocumentSets` of the use cases tells which doc requests to answer.
 */
export type MdocResolvedRequest = {
  useCases: MdocResolvedUseCase[]
} & (
  | {
      /**
       * The stored mdocs can satisfy every doc request.
       */
      success: true
      useCasesSource: 'allDocRequests'
      docRequests: MdocResolvedDocRequestSuccess[]
    }
  | {
      /**
       * The stored mdocs can satisfy every mandatory use case, and at least one use case. The doc
       * requests that cannot be answered are still in `docRequests`.
       */
      success: true
      useCasesSource: 'deviceRequestInfo' | 'eachDocRequest'
      docRequests: MdocResolvedDocRequest[]
    }
  | {
      success: false
      useCasesSource: UseCasesSource
      docRequests: MdocResolvedDocRequest[]
    }
)

/**
 * A resolved `org-iso-mdoc` DC API request.
 */
export type MdocDcApiResolvedRequest = MdocResolvedRequest & {
  origin: string

  /**
   * The parsed DC API request, with the device request and the encryption info and session
   * transcript the response is encrypted to. Needed to create a response. Treat as opaque.
   */
  parsedRequest: unknown
}

/**
 * A credential to answer a doc request of a resolved request with.
 */
export type MdocCredentialForRequest = {
  /**
   * The index of the doc request the credential answers, the `docRequestIndex` of the resolved doc
   * request. Pass several indexes to answer several doc requests of the credential's docType with a
   * single document, which discloses the elements all of them request.
   */
  docRequestIndex: number | number[]

  /**
   * The mdoc record to disclose, or its id.
   */
  record: MdocRecord | string

  /**
   * Which mode to use for usage of the credential instance of this credential.
   *
   * @default {@link CredentialMultiInstanceUseMode.NewOrFirst}
   */
  useMode?: CredentialMultiInstanceUseMode

  /**
   * The requested elements to disclose, per namespace. Defaults to every element the doc request
   * asks for. Pass a subset to leave out elements, for instance the ones the user declined to share.
   */
  elements?: Record<string, string[]>

  /**
   * For a requested element with alternatives in the `requestInfo` of the doc request, the index
   * of the alternative set to disclose in its place, per namespace and element. The claim `options`
   * in the resolved request list the sets the mdoc can disclose. By default the element itself is
   * disclosed, and an alternative set only when it is chosen here.
   */
  alternatives?: Record<string, Record<string, number>>

  /**
   * Values to disclose device signed. Every requested element the mdoc does not contain issuer
   * signed, but that the device key is authorized for in the MSO, has to be provided here: the
   * valid claims with `source: 'deviceSigned'` in the resolved request. Values that are not
   * requested, or that the device key is not authorized for, are left out.
   */
  deviceNameSpaces?: MdocNameSpaces
}

export type MdocDcApiCreateResponseOptions = {
  resolvedRequest: MdocDcApiResolvedRequest
  credentials: MdocCredentialForRequest[]
}

export type MdocSelectCredentialsForRequestOptions = {
  /**
   * Which mode to use for usage of the credential instances. Only credentials that can provide an
   * instance for this mode are selected, and the mode is passed on to the response.
   *
   * @default {@link CredentialMultiInstanceUseMode.NewOrFirst}
   */
  useMode?: CredentialMultiInstanceUseMode
}

/**
 * The credentials selected to answer a resolved request, together with that request. For a resolved
 * DC API request it can be passed to `createDcApiResponse` as is.
 */
export type MdocSelectedCredentials<ResolvedRequest extends MdocResolvedRequest = MdocResolvedRequest> = {
  resolvedRequest: ResolvedRequest
  credentials: Array<
    MdocCredentialForRequest & { docRequestIndex: number; record: MdocRecord; useMode: CredentialMultiInstanceUseMode }
  >
}

export type MdocSignOptions = {
  docType: 'org.iso.18013.5.1.mDL' | (string & {})
  validityInfo: Omit<ValidityInfoOptions, 'validFrom' | 'signed'> &
    Partial<Pick<ValidityInfoOptions, 'signed' | 'validFrom'>>
  namespaces: MdocNameSpaces

  /**
   * The X509 certificate (or certificate chain) to use for signing the mDOC.
   * When an array of certificates is provided, the first certificate is
   * used for signing, and the entire chain is included in the mDOC.
   *
   * The signing certificate MUST have a publicJwk with key id configured,
   * enabling signing with the KMS.
   */
  issuerCertificate: X509Certificate | X509Certificate[]
  holderKey: PublicJwk

  /**
   * The namespaces and data elements the holder key is authorized to authenticate in the
   * `deviceSigned` part of a device response (ISO/IEC 18013-5 9.1.3.4). Every device signed element
   * disclosed in a device response must be authorized here, either through its whole namespace in
   * `namespaces` or individually in `dataElements`.
   *
   * When omitted, the holder key is not authorized to authenticate any device signed element.
   */
  keyAuthorizations?: {
    namespaces?: string[]
    dataElements?: Record<string, string[]>
  }

  statusInfo?: { index: number; uri: string; certificate?: X509Certificate }
}
