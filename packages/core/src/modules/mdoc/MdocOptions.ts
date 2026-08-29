import type { IsoMdocDcApiRequest, IsoMdocDcApiResponse, ValidityInfoOptions } from '@owf/mdoc'
import type { DcqlQuery } from 'dcql'
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

export type MdocDcApiCreateVerificationSessionOptions = {
  docRequests: MdocDocumentRequest[]

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

type MdocDcApiCredentialMatchBase = {
  record: MdocRecord

  /**
   * The claims that would be disclosed if this credential is selected.
   */
  disclosedClaims: MdocNameSpaces
}

export type MdocDcApiCredentialMatch =
  | (MdocDcApiCredentialMatchBase & {
      isFullMatch: true
      missingClaims?: undefined
    })
  | (MdocDcApiCredentialMatchBase & {
      isFullMatch: false

      /**
       * Requested elements the credential does not contain, per namespace. Never empty, as a
       * credential without missing elements is a full match.
       */
      missingClaims: Record<string, string[]>
    })

export type MdocDcApiResolvedDocRequest = {
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

  matches: MdocDcApiCredentialMatch[]
}

export type MdocDcApiResolvedRequest = {
  origin: string
  docRequests: MdocDcApiResolvedDocRequest[]

  /**
   * The parsed request, needed to create a response. Treat as opaque.
   */
  parsedRequest: unknown
}

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
  }>

  deviceNameSpaces?: MdocNameSpaces
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

  statusInfo?: { index: number; uri: string; certificate?: X509Certificate }
}
