import {
  CoseKey,
  type CredentialMatchFailure,
  type CredentialMatchSuccess,
  DeviceRequest,
  defaultVerificationCallback,
  EncryptionInfo,
  Holder,
  IsoMdocDcApi,
  type IsoMdocDcApiParsedRequest,
  type IsoMdocDcApiRequest,
  type IsoMdocDcApiResponse,
  onCategoryCheck,
  reportDeviceRequestMatch,
  Verifier,
} from '@owf/mdoc'
import { AgentContext } from '../../agent'
import { EventEmitter } from '../../agent/EventEmitter'
import { TrustedIssuerContext } from '../../agent/TrustedIssuerContext'
import type { VerificationTypeMdocReaderAuth } from '../../agent/TrustedIssuersForVerification'
import { getMdocContext } from '../../crypto/contexts/mdocContext'
import { injectable } from '../../plugins'
import { mapNonEmptyArray } from '../../types'
import { TypedArrayEncoder } from '../../utils'
import {
  CredentialMultiInstanceUseMode,
  canUseInstanceFromCredentialRecord,
  useInstanceFromCredentialRecord,
} from '../../utils/credentialUse'
import { KeyManagementApi, type KmsJwkPublicAsymmetric, PublicJwk } from '../kms'
import { type EncodedX509Certificate, X509Certificate, X509ModuleConfig, X509Service } from '../x509'
import { convertLegacyTrustedCertificates } from '../x509/utils/convertLegacyTrustedCertificates'
import { Mdoc } from './Mdoc'
import { MdocDeviceResponse } from './MdocDeviceResponse'
import { MdocDeviceRequestNotSatisfiedError, MdocError, MdocVerificationSessionExpiredError } from './MdocError'
import { MdocEventTypes, type MdocVerificationSessionStateChangedEvent } from './MdocEvents'
import type {
  MdocCreateDeviceResponseOptions,
  MdocCredentialForRequest,
  MdocDcApiCreateResponseOptions,
  MdocDcApiCreateVerificationSessionOptions,
  MdocDcApiResolvedRequest,
  MdocDcApiResolveRequestOptions,
  MdocDcApiVerifyResponseOptions,
  MdocFailedCredential,
  MdocResolveDeviceRequestOptions,
  MdocResolvedDeviceRequest,
  MdocResolvedDocRequest,
  MdocResolvedDocRequestSuccess,
  MdocResolvedRequest,
  MdocResolveRequestBaseOptions,
  MdocValidCredential,
} from './MdocOptions'
import { MdocVerificationSessionState } from './MdocVerificationSessionState'
import { mdocSigningJwk, nameSpacesRecordToDeviceNamespaces } from './mdocUtil'
import {
  MdocRecord,
  MdocRepository,
  MdocVerificationSessionRecord,
  MdocVerificationSessionRepository,
} from './repository'
import {
  createDeviceRequestDefinition,
  fromDocRequestInfo,
  getDeviceRequestMatchOptions,
  toDeviceRequestInfoOptions,
  toDocRequestInfoOptions,
  toResolvedUseCase,
} from './utils/deviceRequestDefinition'

const defaultExpiresInSeconds = 5 * 60

/**
 * Verifier and wallet APIs for the ISO/IEC TS 18013-7:2025 Annex C (`org-iso-mdoc`) DC API, and
 * wallet APIs for device requests received over a channel the application handles itself, such as
 * ISO/IEC 18013-5 proximity.
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

    const deviceRequestDefinition = createDeviceRequestDefinition(options)

    const { keyId, publicJwk, backend } = await kms.createKey({ type: { kty: 'EC', crv: 'P-256' } })

    try {
      const readerCertificateChain = options.readerAuth
        ? Array.isArray(options.readerAuth.certificate)
          ? options.readerAuth.certificate
          : [options.readerAuth.certificate]
        : undefined
      const readerKey = readerCertificateChain?.[0].publicJwk
      const mdocContext = getMdocContext(agentContext, { keys: readerKey ? [readerKey] : [] })

      const { request, encryptionInfo } = await IsoMdocDcApi.createRequest(
        {
          docRequests: deviceRequestDefinition.docRequests.map(({ docType, nameSpaces }, docRequestIndex) => ({
            docType,
            namespaces: Object.fromEntries(
              Object.entries(nameSpaces).map(([nameSpace, elements]) => [
                nameSpace,
                Object.fromEntries(
                  Object.entries(elements).map(([elementIdentifier, { intentToRetain }]) => [
                    elementIdentifier,
                    intentToRetain,
                  ])
                ),
              ])
            ),
            requestInfo: options.docRequests[docRequestIndex].requestInfo
              ? toDocRequestInfoOptions(options.docRequests[docRequestIndex].requestInfo)
              : undefined,
          })),
          deviceRequestInfo: options.deviceRequestInfo
            ? toDeviceRequestInfoOptions(options.deviceRequestInfo)
            : undefined,
          // The kms key id stays local, the session record binds it again when decrypting
          recipientPublicKey: CoseKey.fromJwk(PublicJwk.fromPublicJwk(publicJwk).toJson({ includeKid: false })),
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
        deviceRequestDefinition,
        sessionTranscript: {
          type: 'isoMdocDcApi',
          encryptionInfoBase64Url: request.encryptionInfo,
          nonce: TypedArrayEncoder.toBase64Url(encryptionInfo.nonce),
        },
        sessionKey: { keyId, kmsBackend: backend },
        expiresAt: new Date(Date.now() + (options.expiresInSeconds ?? defaultExpiresInSeconds) * 1000),
      })

      await this.mdocVerificationSessionRepository.save(agentContext, verificationSession)
      this.emitStateChangedEvent(agentContext, verificationSession, null)

      return { verificationSession, request }
    } catch (error) {
      await kms.deleteKey({ keyId, backend }).catch((deleteError) => {
        agentContext.config.logger.error(`Failed to delete session key ${keyId} after failed request creation`, {
          deleteError,
          requestCreationError: error,
        })
      })

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

      // The public key is the one in the `encryptionInfo` we sent. The context finds the KMS key of the session by it.
      const { kid: _, ...recipientJwk } = EncryptionInfo.fromBase64Url(sessionTranscript.encryptionInfoBase64Url)
        .recipientPublicKey.jwk
      const recipientKey = CoseKey.fromJwk(recipientJwk)
      const sessionKey = PublicJwk.fromKmsKey({
        keyId: verificationSession.sessionKey.keyId,
        backend: verificationSession.sessionKey.kmsBackend,
        publicJwk: recipientJwk as KmsJwkPublicAsymmetric,
      })
      const mdocContext = getMdocContext(agentContext, { keys: [sessionKey] })

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

      // Per document, the certificate chain it was verified with, which the issuers a doc request
      // accepts are matched against. The x5chain in the document itself is not signed.
      const issuerCertificateChains: Array<Uint8Array[] | undefined> = []
      if (options.trustedCertificates) {
        const { documents } = await deviceResponse.verify(agentContext, {
          trustedCertificates: options.trustedCertificates,
          sessionTranscriptOptions,
          now: options.now,
        })

        for (const { documentIndex, trustedIssuanceChain } of documents) {
          issuerCertificateChains[documentIndex] = trustedIssuanceChain?.map(({ rawCertificate }) => rawCertificate)
        }
      } else {
        // Trust is resolved per document, as each document can be issued by a different issuer and
        // the trust callbacks are given the certificate chain of the document being verified.
        for (const [documentIndex, documentResponse] of deviceResponse.splitIntoSingleDocumentResponses().entries()) {
          // biome-ignore lint/style/noNonNullAssertion: splitIntoSingleDocumentResponses always returns responses with exactly one document
          const mdoc = new Mdoc(documentResponse.deviceResponse.documents![0].issuerSigned)

          const {
            documents: [{ trustedIssuanceChain }],
          } = await documentResponse.verify(agentContext, {
            trustedCertificates: await this.getTrustedCertificatesForMdoc(agentContext, mdoc),
            sessionTranscriptOptions,
            now: options.now,
          })
          issuerCertificateChains[documentIndex] = trustedIssuanceChain?.map(({ rawCertificate }) => rawCertificate)
        }
      }

      // Annex C has no query language such as DCQL, so the device request we sent is what the
      // response has to satisfy. Matched on the full response, as a doc request can be answered by
      // any of the documents in it. The wallet selected its credentials with the same rules. The
      // doc requests are matched by the use cases of the device request, or, without them, by
      // whether the session's definition meant them as alternatives.
      const deviceRequestMatch = Verifier.matchDeviceRequest({
        deviceRequest: TypedArrayEncoder.fromBase64Url(verificationSession.deviceRequestBase64Url),
        deviceResponse: decrypted.deviceResponse,
        matchOptions: getDeviceRequestMatchOptions(verificationSession.deviceRequestDefinition),
        issuerCertificateChains,
      })

      if (!deviceRequestMatch.success) {
        const reasons: string[] = []
        reportDeviceRequestMatch(deviceRequestMatch, ({ status, reason, check }) => {
          if (status === 'FAILED') reasons.push(reason ?? check)
        })

        throw new MdocDeviceRequestNotSatisfiedError(
          deviceRequestMatch,
          `Device response does not satisfy the device request. ${reasons.join('. ')}`
        )
      }

      verificationSession.sessionTranscript = { ...sessionTranscript, origin: options.origin }
      await this.updateState(agentContext, verificationSession, MdocVerificationSessionState.ResponseVerified)

      return { verificationSession, deviceResponse, deviceRequestMatch, origin: options.origin }
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
      X509Service.parseCertificate(agentContext, { encodedCertificate: certificate })
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

    let trustedCertificates = options.trustedReaderCertificates

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
        certificateChain: options.certificateChain,
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

    // Reader trust is not resolved here, but per doc request in `matchDeviceRequest`. `parseRequest`
    // takes a single list of trust anchors for the whole request, while every doc request carries its
    // own reader certificate chain and the trust callbacks are scoped to the chain they are asked about.
    // `parseRequest` therefore only verifies the reader auth signatures.
    const parsedRequest = await IsoMdocDcApi.parseRequest(
      {
        request: options.request,
        origin: options.origin,
        disableReaderCertificateChainValidation: true,
        now: options.now,
      },
      mdocContext
    )

    const resolvedRequest = await this.matchDeviceRequest(agentContext, parsedRequest.deviceRequest, {
      ...options,
      exchange: { type: 'dcApi', origin: parsedRequest.origin },
    })

    return { ...resolvedRequest, origin: parsedRequest.origin, parsedRequest }
  }

  /**
   * Verify the reader authentication of a device request received over a channel the application
   * handles itself, such as ISO/IEC 18013-5 proximity (wallet side), and match it against stored
   * mdocs.
   */
  public async resolveDeviceRequest(
    agentContext: AgentContext,
    options: MdocResolveDeviceRequestOptions
  ): Promise<MdocResolvedDeviceRequest> {
    let deviceRequest: DeviceRequest
    try {
      deviceRequest = DeviceRequest.decode(options.deviceRequest)
    } catch (error) {
      throw new MdocError('Unable to decode the device request', { cause: error })
    }

    // Like `parseRequest` in `resolveRequest`, only the reader auth signatures are verified here. The
    // reader certificate chain of every doc request is checked in `matchDeviceRequest`.
    await Holder.verifyDeviceRequest(
      {
        deviceRequest,
        sessionTranscript: options.sessionTranscript,
        disableCertificateChainValidation: true,
        now: options.now,
      },
      getMdocContext(agentContext)
    )

    const resolvedRequest = await this.matchDeviceRequest(agentContext, deviceRequest, {
      ...options,
      exchange: { type: 'deviceRequest' },
    })

    return { ...resolvedRequest, deviceRequest: options.deviceRequest, sessionTranscript: options.sessionTranscript }
  }

  /**
   * Match a device request, of which the reader auth signatures are verified, against the stored
   * mdocs, and check the reader certificate chain of every doc request.
   */
  private async matchDeviceRequest(
    agentContext: AgentContext,
    deviceRequest: DeviceRequest,
    options: MdocResolveRequestBaseOptions & { exchange: VerificationTypeMdocReaderAuth['exchange'] }
  ): Promise<MdocResolvedRequest> {
    const candidates = await this.getCandidates(
      agentContext,
      deviceRequest.docRequests.map((docRequest) => docRequest.itemsRequest.docType),
      options.useMode ?? CredentialMultiInstanceUseMode.NewOrFirst
    )

    // The same rules the verifier matches the response with, so a credential that matches in full
    // results in a response that satisfies the doc request.
    const deviceNamespaces = options.deviceNameSpaces
      ? nameSpacesRecordToDeviceNamespaces(options.deviceNameSpaces)
      : undefined
    const holderMatch = Holder.matchDeviceRequest({
      deviceRequest,
      credentials: candidates.map(({ mdoc }) => ({ issuerSigned: mdoc.issuerSigned, deviceNamespaces })),
      treatAmbiguousMultipleDocRequestsAsAlternatives: options.treatAmbiguousMultipleDocRequestsAsAlternatives,
    })

    const toValidCredential = ({
      credentialIndex,
      ...credentialMatch
    }: CredentialMatchSuccess): MdocValidCredential => ({
      ...credentialMatch,
      record: candidates[credentialIndex].record,
    })
    const toFailedCredential = ({
      credentialIndex,
      ...credentialMatch
    }: CredentialMatchFailure): MdocFailedCredential => ({
      ...credentialMatch,
      record: candidates[credentialIndex].record,
    })

    const docRequests: MdocResolvedDocRequest[] = []
    for (const [docRequestIndex, docRequest] of deviceRequest.docRequests.entries()) {
      const { itemsRequest } = docRequest
      const nameSpaces = Object.fromEntries(
        Array.from(itemsRequest.namespaces.entries()).map(([nameSpace, elements]) => [
          nameSpace,
          Object.fromEntries(elements.entries()),
        ])
      )

      const readerAuth = docRequest.readerAuth
        ? {
            certificateChain: docRequest.readerAuth.certificateChain.map((certificate) =>
              X509Service.parseCertificate(agentContext, { encodedCertificate: certificate })
            ),
          }
        : undefined

      if (readerAuth) {
        await this.assertTrustedReaderCertificateChain(agentContext, {
          certificateChain: readerAuth.certificateChain,
          verification: {
            type: 'mdocReaderAuth',
            exchange: options.exchange,
            docType: itemsRequest.docType,
            nameSpaces,
          },
          trustedReaderCertificates: options.trustedReaderCertificates,
          now: options.now,
        })
      }

      const docRequestMatch = holderMatch.docRequests[docRequestIndex]
      const requestInfo = itemsRequest.requestInfo
      const resolvedDocRequest = {
        docRequestIndex,
        docType: itemsRequest.docType,
        nameSpaces,
        requestInfo: requestInfo ? fromDocRequestInfo(requestInfo) : undefined,
        readerAuth,
        failedCredentials: docRequestMatch.failedCredentials.map(toFailedCredential),
      }

      docRequests.push(
        docRequestMatch.success
          ? {
              ...resolvedDocRequest,
              success: true,
              validCredentials: mapNonEmptyArray(docRequestMatch.validCredentials, toValidCredential),
            }
          : { ...resolvedDocRequest, success: false, validCredentials: [] }
      )
    }

    // `holderMatch.success` already applies the use cases, so it is the single source of truth for
    // whether the request can be answered. The doc requests are only narrowed to the successful ones
    // when every doc request is requested, as otherwise the failed ones are kept so the wallet can
    // see which use cases it can answer.
    const useCases = holderMatch.useCases.map(toResolvedUseCase)

    if (!holderMatch.success) {
      return { useCases, success: false, useCasesSource: holderMatch.useCasesSource, docRequests }
    }

    if (holderMatch.useCasesSource === 'allDocRequests') {
      return {
        useCases,
        success: true,
        useCasesSource: holderMatch.useCasesSource,
        docRequests: docRequests.filter(
          (docRequest): docRequest is MdocResolvedDocRequestSuccess => docRequest.success
        ),
      }
    }

    return { useCases, success: true, useCasesSource: holderMatch.useCasesSource, docRequests }
  }

  /**
   * Fetch the stored mdocs for the requested doctypes.
   *
   * Only the requested doctypes are fetched, as a wallet can hold many more mdocs than a request
   * covers. The issuer-signed CBOR of each record is decoded once, and matched against every doc
   * request from there.
   *
   * Records that cannot provide an instance for `useMode` are left out, as creating a response with
   * them would throw.
   */
  private async getCandidates(agentContext: AgentContext, docTypes: string[], useMode: CredentialMultiInstanceUseMode) {
    const uniqueDocTypes = Array.from(new Set(docTypes))
    if (uniqueDocTypes.length === 0) return []

    const records = await this.mdocRepository.findByQuery(agentContext, {
      $or: uniqueDocTypes.map((docType) => ({ docType })),
    })

    return records
      .filter((record) => canUseInstanceFromCredentialRecord({ credentialRecord: record, useMode }))
      .map((record) => ({ record, mdoc: record.firstCredential }))
  }

  /**
   * Create the encrypted `org-iso-mdoc` response (wallet side).
   */
  public async createResponse(
    agentContext: AgentContext,
    options: MdocDcApiCreateResponseOptions
  ): Promise<IsoMdocDcApiResponse> {
    const parsedRequest = options.resolvedRequest.parsedRequest as IsoMdocDcApiParsedRequest
    const { documents, deviceKeys } = await this.getResponseDocuments(agentContext, options.credentials)

    return await IsoMdocDcApi.createResponse(
      { parsedRequest, documents },
      getMdocContext(agentContext, { keys: deviceKeys })
    )
  }

  /**
   * Create the device response for a request resolved with {@link MdocDcApiService.resolveDeviceRequest}
   * (wallet side). It is not encrypted, as the application encrypts it for its session.
   */
  public async createDeviceResponse(
    agentContext: AgentContext,
    options: MdocCreateDeviceResponseOptions
  ): Promise<MdocDeviceResponse> {
    const { documents, deviceKeys } = await this.getResponseDocuments(agentContext, options.credentials)

    const deviceResponse = await Holder.createDeviceResponseForDeviceRequest(
      {
        deviceRequest: DeviceRequest.decode(options.resolvedRequest.deviceRequest),
        sessionTranscript: options.resolvedRequest.sessionTranscript,
        documents: documents.map(({ deviceKey, ...document }) => ({
          ...document,
          signature: { signingKey: deviceKey },
        })),
      },
      getMdocContext(agentContext, { keys: deviceKeys })
    )

    return MdocDeviceResponse.fromBase64Url(TypedArrayEncoder.toBase64Url(deviceResponse.encode()))
  }

  /**
   * The documents to answer a resolved request with, one per credential, and the device keys to sign
   * them with.
   */
  private async getResponseDocuments(agentContext: AgentContext, credentials: MdocCredentialForRequest[]) {
    const deviceKeys: PublicJwk[] = []

    const documents = await Promise.all(
      credentials.map(async ({ docRequestIndex, record, useMode, elements, alternatives, deviceNameSpaces }) => {
        const mdocRecord =
          record instanceof MdocRecord ? record : await this.mdocRepository.getById(agentContext, record)

        const { credentialInstance: mdoc } = await useInstanceFromCredentialRecord({
          agentContext,
          credentialRecord: mdocRecord,
          useMode: useMode ?? CredentialMultiInstanceUseMode.NewOrFirst,
        })

        const deviceKey = mdoc.deviceKey
        if (!deviceKey.hasKeyId) {
          throw new MdocError('Unable to create device response. The mdoc device key has no key id.')
        }
        deviceKeys.push(deviceKey)

        return {
          docRequestIndex,
          issuerSigned: mdoc.issuerSigned,
          deviceKey: CoseKey.fromJwk(mdocSigningJwk(deviceKey)),
          elements,
          alternatives,
          deviceNamespaces: deviceNameSpaces ? nameSpacesRecordToDeviceNamespaces(deviceNameSpaces) : undefined,
        }
      })
    )

    return { documents, deviceKeys }
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
