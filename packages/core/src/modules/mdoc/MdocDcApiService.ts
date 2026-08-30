import {
  CoseKey,
  DeviceNamespaces,
  DeviceSignedItems,
  defaultVerificationCallback,
  EncryptionInfo,
  IsoMdocDcApi,
  type IsoMdocDcApiParsedRequest,
  type IsoMdocDcApiRequest,
  type IsoMdocDcApiResponse,
  onCategoryCheck,
} from '@owf/mdoc'
import { AgentContext } from '../../agent'
import { EventEmitter } from '../../agent/EventEmitter'
import { TrustedIssuerContext } from '../../agent/TrustedIssuerContext'
import type { VerificationTypeMdocReaderAuth } from '../../agent/TrustedIssuersForVerification'
import { getMdocContext } from '../../crypto/contexts/mdocContext'
import { injectable } from '../../plugins'
import { TypedArrayEncoder } from '../../utils'
import {
  CredentialMultiInstanceUseMode,
  canUseInstanceFromCredentialRecord,
  useInstanceFromCredentialRecord,
} from '../../utils/credentialUse'
import { KeyManagementApi } from '../kms'
import { type EncodedX509Certificate, X509Certificate, X509ModuleConfig, X509Service } from '../x509'
import { convertLegacyTrustedCertificates } from '../x509/utils/convertLegacyTrustedCertificates'
import { Mdoc } from './Mdoc'
import { MdocDeviceResponse } from './MdocDeviceResponse'
import { MdocError, MdocVerificationSessionExpiredError } from './MdocError'
import { MdocEventTypes, type MdocVerificationSessionStateChangedEvent } from './MdocEvents'
import type {
  MdocDcApiCreateResponseOptions,
  MdocDcApiCreateVerificationSessionOptions,
  MdocDcApiCredentialMatch,
  MdocDcApiResolvedDocRequest,
  MdocDcApiResolvedRequest,
  MdocDcApiResolveRequestOptions,
  MdocDcApiVerifyResponseOptions,
  MdocNameSpaces,
} from './MdocOptions'
import { MdocVerificationSessionState } from './MdocVerificationSessionState'
import { mdocSigningJwk } from './mdocUtil'
import {
  MdocRecord,
  MdocRepository,
  MdocVerificationSessionRecord,
  MdocVerificationSessionRepository,
} from './repository'

const defaultExpiresInSeconds = 5 * 60

/**
 * Verifier and wallet APIs for the ISO/IEC TS 18013-7:2025 Annex C (`org-iso-mdoc`) DC API.
 *
 * @internal
 */
@injectable()
export class MdocDcApiService {
  public constructor(
    private mdocRepository: MdocRepository,
    private mdocVerificationSessionRepository: MdocVerificationSessionRepository,
    private eventEmitter: EventEmitter
  ) {}

  /**
   * Create an `org-iso-mdoc` request (verifier side) and persist a verification session for it.
   *
   * The origin is not part of the request payload; it only enters the protocol through the session
   * transcript. It therefore has to be supplied again to {@link MdocDcApiService.verifyResponse},
   * except that a `readerAuth` request signs over the transcript and is fixed to the origin it is
   * created for.
   */
  public async createVerificationSession(
    agentContext: AgentContext,
    options: MdocDcApiCreateVerificationSessionOptions
  ): Promise<{ verificationSession: MdocVerificationSessionRecord; request: IsoMdocDcApiRequest }> {
    const kms = agentContext.resolve(KeyManagementApi)
    const mdocContext = getMdocContext(agentContext)

    const { keyId, publicJwk } = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    try {
      const readerCertificateChain = options.readerAuth
        ? Array.isArray(options.readerAuth.certificate)
          ? options.readerAuth.certificate
          : [options.readerAuth.certificate]
        : undefined

      const { request, encryptionInfo } = await IsoMdocDcApi.createRequest(
        {
          docRequests: options.docRequests.map(({ docType, nameSpaces }) => ({ docType, namespaces: nameSpaces })),
          recipientPublicKey: CoseKey.fromJwk({ ...publicJwk, kid: keyId }),
          readerAuth:
            readerCertificateChain && options.readerAuth
              ? {
                  signingKey: CoseKey.fromJwk(mdocSigningJwk(readerCertificateChain[0].publicJwk)),
                  certificateChain: readerCertificateChain.map((certificate) => certificate.rawCertificate),
                  origin: options.readerAuth.origin,
                }
              : undefined,
        },
        mdocContext
      )

      const verificationSession = new MdocVerificationSessionRecord({
        state: MdocVerificationSessionState.RequestCreated,
        deviceRequestBase64Url: request.deviceRequest,
        sessionTranscript: {
          type: 'isoMdocDcApi',
          encryptionInfoBase64Url: request.encryptionInfo,
          nonce: TypedArrayEncoder.toBase64Url(encryptionInfo.nonce),
        },
        sessionKeyId: keyId,
        expiresAt: new Date(Date.now() + (options.expiresInSeconds ?? defaultExpiresInSeconds) * 1000),
      })

      await this.mdocVerificationSessionRepository.save(agentContext, verificationSession)
      this.emitStateChangedEvent(agentContext, verificationSession, null)

      return { verificationSession, request }
    } catch (error) {
      await kms.deleteKey({ keyId })
      throw error
    }
  }

  /**
   * Decrypt and verify an `org-iso-mdoc` response (verifier side).
   *
   * The response is bound to the origin through the session transcript, so decryption only succeeds
   * for the origin the wallet actually used. That is what makes a response relayed from another
   * origin fail.
   */
  public async verifyResponse(agentContext: AgentContext, options: MdocDcApiVerifyResponseOptions) {
    const mdocContext = getMdocContext(agentContext)

    const verificationSession = await this.mdocVerificationSessionRepository.getById(
      agentContext,
      options.verificationSessionId
    )
    verificationSession.assertState(MdocVerificationSessionState.RequestCreated)

    const sessionTranscript = verificationSession.getSessionTranscript('isoMdocDcApi')
    const response = options.response.response

    try {
      if (verificationSession.isExpired) {
        throw new MdocVerificationSessionExpiredError(verificationSession.expiresAt)
      }

      // The recipient key is identified by the `keyId` on the public key, the same way signing keys
      // are resolved. Take the public key from the `encryptionInfo` we sent, and bind the `keyId`
      // from the session record so the KMS resolves the private key we created for this session.
      const recipientKey = CoseKey.fromJwk({
        ...EncryptionInfo.fromBase64Url(sessionTranscript.encryptionInfoBase64Url).recipientPublicKey.jwk,
        kid: verificationSession.sessionKeyId,
      })

      const decrypted = await IsoMdocDcApi.decryptResponse(
        {
          response,
          origin: options.origin,
          encryptionInfo: sessionTranscript.encryptionInfoBase64Url,
          recipientKey,
        },
        mdocContext
      )

      const deviceResponse = MdocDeviceResponse.fromBase64Url(
        TypedArrayEncoder.toBase64Url(decrypted.deviceResponse.encode())
      )

      const sessionTranscriptOptions = {
        type: 'sessionTranscriptBytes',
        sessionTranscriptBytes: decrypted.sessionTranscript.encode(),
      } as const

      if (options.trustedCertificates) {
        await deviceResponse.verify(agentContext, {
          trustedCertificates: options.trustedCertificates,
          sessionTranscriptOptions,
          now: options.now,
        })
      } else {
        // Trust is resolved per document, as each document can be issued by a different issuer and
        // the trust callbacks are given the certificate chain of the document being verified.
        for (const documentResponse of deviceResponse.splitIntoSingleDocumentResponses()) {
          // biome-ignore lint/style/noNonNullAssertion: splitIntoSingleDocumentResponses always returns responses with exactly one document
          const mdoc = new Mdoc(documentResponse.deviceResponse.documents![0].issuerSigned)

          await documentResponse.verify(agentContext, {
            trustedCertificates: await this.getTrustedCertificatesForMdoc(agentContext, mdoc),
            sessionTranscriptOptions,
            now: options.now,
          })
        }
      }

      verificationSession.sessionTranscript = { ...sessionTranscript, origin: options.origin }
      await this.updateState(agentContext, verificationSession, MdocVerificationSessionState.ResponseVerified)

      return { verificationSession, deviceResponse, origin: options.origin }
    } catch (error) {
      verificationSession.errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.updateState(agentContext, verificationSession, MdocVerificationSessionState.Error)

      throw error
    }
  }

  /**
   * Resolve the trusted certificates for a single mdoc in a device response.
   *
   * Same resolution order as the other credential verification paths: the global
   * `getTrustedIssuersForVerification` callback first, then the deprecated
   * `getTrustedCertificatesForVerification` callback, and only if neither returns anything the
   * statically configured trusted certificates. Both callbacks receive the certificate chain of
   * the mdoc being verified, so trust can be decided per document.
   */
  private async getTrustedCertificatesForMdoc(agentContext: AgentContext, mdoc: Mdoc) {
    const x509ModuleConfig = agentContext.dependencyManager.resolve(X509ModuleConfig)
    const certificateChain = mdoc.issuerSignedCertificateChain.map((certificate) =>
      X509Certificate.fromRawCertificate(certificate)
    )

    const trustedIssuers = await TrustedIssuerContext.getTrustedIssuersForVerification(agentContext, {
      signer: {
        method: 'x509',
        certificateChain,
      },
      verification: {
        type: 'credential',
        credential: mdoc,
      },
    })

    return (
      trustedIssuers?.trustedIssuers ??
      (await x509ModuleConfig.getTrustedCertificatesForVerification?.(agentContext, {
        certificateChain,
        verification: {
          type: 'credential',
          credential: mdoc,
        },
      })) ??
      x509ModuleConfig.trustedCertificates ??
      []
    )
  }

  /**
   * Assert the reader certificate chain of a single doc request is trusted.
   *
   * Same resolution order as the issuer trust in {@link MdocDcApiService.getTrustedCertificatesForMdoc}:
   * the certificates passed to `resolveRequest` first, then the global
   * `getTrustedIssuersForVerification` callback, then the deprecated
   * `getTrustedCertificatesForVerification` callback, and only if none of these return anything
   * the statically configured trusted certificates.
   *
   * As everywhere else x509 signers are verified, resolving nothing is not a reason to continue
   * without establishing trust: the reader certificate chain is signed by the reader itself, so
   * skipping the chain check would leave the reader identity self-asserted. A wallet that wants to
   * decide on the reader identity itself can return the leaf certificate from the callback, which
   * trusts the reader on the certificate it presented.
   */
  private async assertTrustedReaderCertificateChain(
    agentContext: AgentContext,
    options: {
      certificateChain: X509Certificate[]
      verification: VerificationTypeMdocReaderAuth
      trustedReaderCertificates?: Array<EncodedX509Certificate | X509Certificate>
      now?: Date
    }
  ) {
    const x509ModuleConfig = agentContext.dependencyManager.resolve(X509ModuleConfig)

    let trustedCertificates = options.trustedReaderCertificates?.map((certificate) =>
      typeof certificate === 'string' ? certificate : certificate.toString('pem')
    )

    if (!trustedCertificates) {
      const trustedIssuers = await TrustedIssuerContext.getTrustedIssuersForVerification(agentContext, {
        signer: {
          method: 'x509',
          certificateChain: options.certificateChain,
        },
        verification: options.verification,
      })

      const legacyTrustedCertificates = trustedIssuers
        ? undefined
        : await x509ModuleConfig.getTrustedCertificatesForVerification?.(agentContext, {
            certificateChain: options.certificateChain,
            verification: options.verification,
          })

      trustedCertificates =
        trustedIssuers?.trustedIssuers.flatMap(({ issuance }) => issuance) ??
        (legacyTrustedCertificates
          ? convertLegacyTrustedCertificates(legacyTrustedCertificates).flatMap(({ issuance }) => issuance)
          : undefined) ??
        x509ModuleConfig.trustedCertificates
    }

    if (!trustedCertificates) {
      throw new MdocError('No trusted certificates found. Cannot verify reader authentication.')
    }

    // Reported as a check rather than thrown directly, so it fails the same way as the reader auth
    // signature check in `parseRequest`. The default callback throws on a failed check.
    const onCheck = onCategoryCheck(defaultVerificationCallback, 'READER_AUTH')
    try {
      await X509Service.validateCertificateChain(agentContext, {
        certificateChain: options.certificateChain.map((certificate) => certificate.toString('pem')),
        trustedCertificates,
        verificationDate: options.now,
      })

      onCheck({
        status: 'PASSED',
        check: 'Reader certificate chain must be trusted',
      })
    } catch (error) {
      onCheck({
        status: 'FAILED',
        check: 'Reader certificate chain must be trusted',
        reason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Parse an incoming `org-iso-mdoc` request (wallet side) and match it against stored mdocs.
   *
   * `origin` must be the origin provided by the platform; Annex C C.5 requires the mdoc to abort
   * when no origin was received.
   */
  public async resolveRequest(
    agentContext: AgentContext,
    options: MdocDcApiResolveRequestOptions
  ): Promise<MdocDcApiResolvedRequest> {
    const mdocContext = getMdocContext(agentContext)

    // Reader trust is not resolved here, but per doc request below. `parseRequest` takes a single
    // list of trust anchors for the whole request, while every doc request carries its own reader
    // certificate chain and the trust callbacks are scoped to the chain they are asked about.
    const parsedRequest = await IsoMdocDcApi.parseRequest(
      {
        request: options.request,
        origin: options.origin,
        now: options.now,
      },
      mdocContext
    )

    const candidatesByDocType = await this.getCandidatesByDocType(
      agentContext,
      parsedRequest.docRequests.map((docRequest) => docRequest.docType),
      options.useMode ?? CredentialMultiInstanceUseMode.NewOrFirst
    )

    const docRequests: MdocDcApiResolvedDocRequest[] = []
    for (const [docRequestIndex, docRequest] of parsedRequest.docRequests.entries()) {
      const nameSpaces = Object.fromEntries(
        Array.from(docRequest.namespaces.entries()).map(([nameSpace, elements]) => [
          nameSpace,
          Object.fromEntries(elements.entries()),
        ])
      )

      const readerAuth = docRequest.readerAuthenticated
        ? {
            certificateChain: (docRequest.readerCertificateChain ?? []).map((certificate) =>
              X509Certificate.fromRawCertificate(certificate)
            ),
          }
        : undefined

      if (readerAuth) {
        await this.assertTrustedReaderCertificateChain(agentContext, {
          certificateChain: readerAuth.certificateChain,
          verification: {
            type: 'mdocReaderAuth',
            exchange: { type: 'dcApi', origin: parsedRequest.origin },
            docType: docRequest.docType,
            nameSpaces,
          },
          trustedReaderCertificates: options.trustedReaderCertificates,
          now: options.now,
        })
      }

      const matches: MdocDcApiCredentialMatch[] = (candidatesByDocType.get(docRequest.docType) ?? []).map(
        ({ record, mdoc }) => {
          const available = mdoc.issuerSignedNamespaces
          const disclosedClaims: MdocNameSpaces = {}
          const missingClaims: Record<string, string[]> = {}

          for (const [nameSpace, elements] of Object.entries(nameSpaces)) {
            for (const elementIdentifier of Object.keys(elements)) {
              if (available[nameSpace] && elementIdentifier in available[nameSpace]) {
                disclosedClaims[nameSpace] = {
                  ...disclosedClaims[nameSpace],
                  [elementIdentifier]: available[nameSpace][elementIdentifier],
                }
              } else {
                missingClaims[nameSpace] = [...(missingClaims[nameSpace] ?? []), elementIdentifier]
              }
            }
          }

          return Object.keys(missingClaims).length === 0
            ? { record, disclosedClaims, isFullMatch: true }
            : { record, disclosedClaims, isFullMatch: false, missingClaims }
        }
      )

      docRequests.push({
        docRequestIndex,
        docType: docRequest.docType,
        nameSpaces,
        readerAuth,
        matches,
      })
    }

    return { origin: parsedRequest.origin, docRequests, parsedRequest }
  }

  /**
   * Fetch the stored mdocs for the requested doctypes, grouped by doctype.
   *
   * Only the requested doctypes are fetched, as a wallet can hold many more mdocs than a request
   * covers. The grouping decodes the issuer-signed CBOR of each record exactly once, where matching
   * on the records directly would decode it again for every doc request and every claim lookup.
   *
   * Records that cannot provide an instance for `useMode` are left out, as creating a response with
   * them would throw.
   */
  private async getCandidatesByDocType(
    agentContext: AgentContext,
    docTypes: string[],
    useMode: CredentialMultiInstanceUseMode
  ) {
    const candidatesByDocType = new Map<string, Array<{ record: MdocRecord; mdoc: Mdoc }>>()

    const uniqueDocTypes = Array.from(new Set(docTypes))
    if (uniqueDocTypes.length === 0) return candidatesByDocType

    const records = await this.mdocRepository.findByQuery(agentContext, {
      $or: uniqueDocTypes.map((docType) => ({ docType })),
    })

    for (const record of records) {
      if (!canUseInstanceFromCredentialRecord({ credentialRecord: record, useMode })) continue

      const mdoc = record.firstCredential

      const candidates = candidatesByDocType.get(mdoc.docType)
      if (candidates) candidates.push({ record, mdoc })
      else candidatesByDocType.set(mdoc.docType, [{ record, mdoc }])
    }

    return candidatesByDocType
  }

  /**
   * Create the encrypted `org-iso-mdoc` response (wallet side).
   */
  public async createResponse(
    agentContext: AgentContext,
    options: MdocDcApiCreateResponseOptions
  ): Promise<IsoMdocDcApiResponse> {
    const mdocContext = getMdocContext(agentContext)
    const parsedRequest = options.resolvedRequest.parsedRequest as IsoMdocDcApiParsedRequest

    const documents = await Promise.all(
      options.credentials.map(async ({ docRequestIndex, record, useMode }) => {
        const mdocRecord =
          record instanceof MdocRecord ? record : await this.mdocRepository.getById(agentContext, record)

        const { credentialInstance: mdoc } = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: mdocRecord,
          useMode: useMode ?? CredentialMultiInstanceUseMode.NewOrFirst,
        })

        const deviceKeyJwk = mdocSigningJwk(mdoc.deviceKey)
        if (!deviceKeyJwk.kid) {
          throw new MdocError('Unable to create device response. The mdoc device key has no key id.')
        }

        return {
          docRequestIndex,
          issuerSigned: mdoc.issuerSigned,
          deviceKey: CoseKey.fromJwk(deviceKeyJwk),
          deviceNamespaces: options.deviceNameSpaces
            ? DeviceNamespaces.create({
                deviceNamespaces: new Map(
                  Object.entries(options.deviceNameSpaces).map(([nameSpace, values]) => [
                    nameSpace,
                    DeviceSignedItems.create({ deviceSignedItems: new Map(Object.entries(values)) }),
                  ])
                ),
              })
            : undefined,
        }
      })
    )

    return await IsoMdocDcApi.createResponse({ parsedRequest, documents }, mdocContext)
  }

  private async updateState(
    agentContext: AgentContext,
    verificationSession: MdocVerificationSessionRecord,
    newState: MdocVerificationSessionState
  ) {
    const previousState = verificationSession.state
    verificationSession.state = newState

    await this.mdocVerificationSessionRepository.update(agentContext, verificationSession)
    this.emitStateChangedEvent(agentContext, verificationSession, previousState)
  }

  private emitStateChangedEvent(
    agentContext: AgentContext,
    verificationSession: MdocVerificationSessionRecord,
    previousState: MdocVerificationSessionState | null
  ) {
    this.eventEmitter.emit<MdocVerificationSessionStateChangedEvent>(agentContext, {
      type: MdocEventTypes.MdocVerificationSessionStateChanged,
      payload: {
        verificationSession: verificationSession.clone(),
        previousState,
      },
    })
  }
}
