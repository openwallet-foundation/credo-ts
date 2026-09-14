import type {
  ClaimMatch,
  CredentialMatchFailure,
  CredentialMatchSuccess,
  DeviceRequestMatchResult,
  IsoMdocDcApiRequest,
  IsoMdocDcApiResponse,
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
 * The device request as the verifier defined it, including the options that only apply when matching
 * the response.
 *
 * Follows the structure of the `DeviceRequest`, so the request info of the second edition of ISO/IEC
 * 18013-5 (`DeviceRequestInfo` with its use cases, `DocRequestInfo` per doc request) can be added as
 * optional members without changing what is stored for existing verification sessions.
 */
export type MdocDeviceRequestDefinition = {
  /**
   * The doc requests in request order, so the index of a doc request here is its index in the
   * device request.
   */
  docRequests: MdocDocRequestDefinition[]
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
}

export type MdocDcApiCreateVerificationSessionOptions = {
  /**
   * The documents to request. The response has to satisfy every doc request, which by default means
   * that each requested element must be disclosed and issuer signed. Pass an
   * {@link MdocRequestedElement} for elements that may be left out, or that may (or must) be device
   * signed instead.
   *
   * Stored on the verification session, and applied when the response is verified.
   */
  docRequests: MdocDcApiDocRequest[]

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
 * authorized for it: its value has to be provided in the `deviceNameSpaces` of the credential when
 * creating the response.
 */
export type MdocDcApiValidCredential = Omit<CredentialMatchSuccess, 'credentialIndex'> & {
  record: MdocRecord
}

/**
 * A stored mdoc that does not satisfy a doc request, with per check what failed. An mdoc of the
 * requested docType that is missing requested claims has a successful `docType` check and its
 * `claims.failedClaims`.
 */
export type MdocDcApiFailedCredential = Omit<CredentialMatchFailure, 'credentialIndex'> & {
  record: MdocRecord
}

export type MdocDcApiCredentialMatch = MdocDcApiValidCredential | MdocDcApiFailedCredential

type MdocDcApiResolvedDocRequestBase = {
  docRequestIndex: number
  docType: string

  /**
   * Requested elements per namespace, mapped to their `intentToRetain` value.
   */
  nameSpaces: Record<string, Record<string, boolean>>

  /**
   * The reader authentication carried by the doc request, of which both the signature and the
   * trust of the certificate chain were verified. Annex C makes reader auth optional, so an
   * absent `readerAuth` means no signature was present — not that verification failed.
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
  failedCredentials: MdocDcApiFailedCredential[]
}

/**
 * At least one stored mdoc satisfies the doc request.
 */
export type MdocDcApiResolvedDocRequestSuccess = MdocDcApiResolvedDocRequestBase & {
  success: true
  validCredentials: NonEmptyArray<MdocDcApiValidCredential>
}

/**
 * No stored mdoc satisfies the doc request.
 */
export type MdocDcApiResolvedDocRequestFailure = MdocDcApiResolvedDocRequestBase & {
  success: false
  validCredentials: []
}

export type MdocDcApiResolvedDocRequest = MdocDcApiResolvedDocRequestSuccess | MdocDcApiResolvedDocRequestFailure

type MdocDcApiResolvedRequestBase = {
  origin: string

  /**
   * The parsed request, needed to create a response. Treat as opaque.
   */
  parsedRequest: unknown
}

/**
 * Checking `success` narrows the doc requests: when it is `true`, every doc request has at least one
 * valid credential.
 */
export type MdocDcApiResolvedRequest = MdocDcApiResolvedRequestBase &
  (
    | {
        /**
         * The stored mdocs can satisfy every doc request.
         */
        success: true
        docRequests: MdocDcApiResolvedDocRequestSuccess[]
      }
    | {
        success: false
        docRequests: MdocDcApiResolvedDocRequest[]
      }
  )

export type MdocDcApiCreateResponseOptions = {
  resolvedRequest: MdocDcApiResolvedRequest

  credentials: Array<{
    /**
     * Index into `resolvedRequest.docRequests`.
     */
    docRequestIndex: number

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
     * Values to disclose device signed. Every requested element the mdoc does not contain issuer
     * signed, but that the device key is authorized for in the MSO, has to be provided here: the
     * valid claims with `source: 'deviceSigned'` in the resolved request.
     */
    deviceNameSpaces?: MdocNameSpaces
  }>
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
