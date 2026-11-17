import type { AgentContext, DidPurpose, JwsDetachedFormat, SdJwtVcHolderBinding, XOR } from '@credo-ts/core'
import {
  CredoError,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  isJsonObject,
  JsonEncoder,
  JwsService,
  JwtPayload,
  Kms,
  parseDid,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { DidCommAttachment, DidCommAttachmentData } from '../../../decorators/attachment/DidCommAttachment'
import {
  DidCommSignedAttachmentBindingMethods,
  type DidCommSignedAttachmentCredentialRequestBindingProof,
  DidCommSignedAttachmentOfferBindingMethod,
  type DidCommSignedAttachmentWithJwkCreateOfferOptions,
} from './didCommSignedAttachmentBinding'

async function resolveSigningKeyFromDidUrl(
  agentContext: AgentContext,
  kid: string,
  { allowedPurposes, didMethodsSupported }: { allowedPurposes?: DidPurpose[]; didMethodsSupported?: string[] }
): Promise<{ publicJwk: Kms.PublicJwk; keyId: string }> {
  if (!kid.startsWith('did:')) {
    throw new CredoError(`kid '${kid}' is not a DID. Only dids are supported for kid`)
  }
  if (!kid.includes('#')) {
    throw new CredoError(
      `kid '${kid}' does not contain a fragment. kid MUST point to a specific key in the did document.`
    )
  }

  const parsedDid = parseDid(kid)
  if (didMethodsSupported && !didMethodsSupported.includes(parsedDid.method)) {
    throw new CredoError(`DID method '${parsedDid.method}' is not supported by the issuer`)
  }

  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const { didDocument, keys } = await didsApi.resolveCreatedDidDocumentWithKeys(parsedDid.did)
  const verificationMethod = didDocument.dereferenceKey(kid, allowedPurposes)

  // TODO: we need an util 'getPublicJwkWithSigningKeyIdFromVerificationMethodId'
  const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)
  const keyId =
    keys?.find(({ didDocumentRelativeKeyId }) => didDocumentRelativeKeyId === `#${parsedDid.fragment}`)?.kmsKeyId ??
    publicJwk.legacyKeyId

  return { publicJwk, keyId }
}

/**
 * Creates a DIDComm signed attachment containing a JWS over the given data.
 * Used for binding proofs in credential request messages.
 */
export async function createDidCommSignedAttachment(
  agentContext: AgentContext,
  data: { nonce: string },
  options: XOR<{ alg?: string; kid: string }, { alg?: string; jwk: Kms.PublicJwk }>,
  issuerSupportedAlgs: string[],
  { allowedPurposes, didMethodsSupported }: { allowedPurposes?: DidPurpose[]; didMethodsSupported?: string[] } = {}
): Promise<DidCommAttachment> {
  const { alg } = options
  const { publicJwk, keyId } = options.jwk
    ? { publicJwk: options.jwk, keyId: options.jwk.keyId }
    : await resolveSigningKeyFromDidUrl(agentContext, options.kid, { allowedPurposes, didMethodsSupported })

  if (alg && !publicJwk.supportedSignatureAlgorithms.includes(alg as Kms.KnownJwaSignatureAlgorithm)) {
    throw new CredoError(`jwk ${publicJwk.jwkTypeHumanDescription}, does not support the JWS signature alg '${alg}'`)
  }

  const signingAlg = issuerSupportedAlgs.find(
    (supportedAlg) =>
      publicJwk.supportedSignatureAlgorithms.includes(supportedAlg as Kms.KnownJwaSignatureAlgorithm) &&
      (alg === undefined || alg === supportedAlg)
  )
  if (!signingAlg) throw new CredoError('No signing algorithm supported by the issuer found')

  const jwsService = agentContext.dependencyManager.resolve(JwsService)
  const jws = await jwsService.createJws(agentContext, {
    keyId,
    header: {},
    payload: new JwtPayload({ additionalClaims: { nonce: data.nonce } }),
    protectedHeaderOptions: {
      alg: signingAlg as Kms.KnownJwaSignatureAlgorithm,
      ...(options.jwk ? { jwk: options.jwk.toJson({ includeKid: false }) } : { kid: options.kid }),
    },
  })

  const signedAttach = new DidCommAttachment({
    mimeType: 'application/json',
    data: new DidCommAttachmentData({
      base64: jws.payload,
    }),
  })

  signedAttach.addJws(jws)

  return signedAttach
}

interface VerifyDidCommSignedAttachmentOptions {
  algsSupported?: string[]
  allowedPurposes?: DidPurpose[]
  didMethodsSupported?: string[]
  jwkSupported?: boolean
}

/**
 * Verifies a DIDComm signed attachment and returns the payload.
 * Used by issuers to verify binding proofs in credential requests.
 */
export function verifyDidCommSignedAttachment(
  agentContext: AgentContext,
  signedAttachment: DidCommAttachment,
  options?: VerifyDidCommSignedAttachmentOptions & { jwkSupported?: false }
): Promise<{ nonce: string; kid: string; publicJwk: Kms.PublicJwk }>
export function verifyDidCommSignedAttachment(
  agentContext: AgentContext,
  signedAttachment: DidCommAttachment,
  options: VerifyDidCommSignedAttachmentOptions
): Promise<{ nonce: string; kid?: string; publicJwk: Kms.PublicJwk }>
export async function verifyDidCommSignedAttachment(
  agentContext: AgentContext,
  signedAttachment: DidCommAttachment,
  { algsSupported, allowedPurposes, didMethodsSupported, jwkSupported }: VerifyDidCommSignedAttachmentOptions = {}
): Promise<{ nonce: string; kid?: string; publicJwk: Kms.PublicJwk }> {
  const jws = signedAttachment.data.jws as JwsDetachedFormat
  if (!jws) throw new CredoError('Missing jws in signed attachment')
  if (!jws.protected) throw new CredoError('Missing protected header in signed attachment')
  if (!signedAttachment.data.base64) throw new CredoError('Missing payload in signed attachment')

  const protectedHeader = JsonEncoder.fromBase64Url(jws.protected)
  if (algsSupported && !algsSupported.includes(protectedHeader.alg)) {
    throw new CredoError(
      `alg '${protectedHeader.alg}' is not one of the supported algorithms ${algsSupported.join(', ')}`
    )
  }
  if (jwkSupported && protectedHeader.jwk !== undefined) {
    if (protectedHeader.kid !== undefined) {
      throw new CredoError("The protected header must not have both 'kid' and 'jwk'")
    }
    Kms.assertJwkHasNoPrivateKeyMaterial(protectedHeader.jwk)
    if ('x5u' in protectedHeader.jwk) throw new CredoError("The 'jwk' in the protected header must not have 'x5u'")
  }

  const jwsService = agentContext.dependencyManager.resolve(JwsService)
  const {
    isValid,
    jwsSigners: [jwsSigner],
  } = await jwsService.verifyJws(agentContext, {
    jws: {
      header: jws.header,
      protected: jws.protected,
      signature: jws.signature,
      payload: TypedArrayEncoder.toBase64Url(signedAttachment.getDataAsUint8Array()),
    },
    allowedJwsSignerMethods: jwkSupported ? ['did', 'jwk'] : ['did'],
    resolveJwsSigner: async ({ protectedHeader: { kid, alg } }) => {
      if (!kid || typeof kid !== 'string') throw new CredoError('Missing kid in protected header.')
      if (!kid.startsWith('did:')) throw new CredoError('Only did is supported for kid identifier')
      if (didMethodsSupported) {
        const { method } = parseDid(kid)
        if (!didMethodsSupported.includes(method)) {
          throw new CredoError(`DID method '${method}' is not supported by the issuer`)
        }
      }

      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const didDocument = await didsApi.resolveDidDocument(kid)
      const verificationMethod = didDocument.dereferenceKey(kid, allowedPurposes)
      const publicJwk = getPublicJwkFromVerificationMethod(verificationMethod)

      return {
        alg,
        method: 'did',
        didUrl: kid,
        jwk: publicJwk,
      }
    },
  })

  if (!isValid) throw new CredoError('Failed to validate signature of signed attachment')

  const payload = signedAttachment.getDataAsJson<{ nonce: string }>()
  if (!payload.nonce || typeof payload.nonce !== 'string') {
    throw new CredoError('Invalid payload in signed attachment')
  }

  if (jwsSigner?.method === 'jwk') return { nonce: payload.nonce, publicJwk: jwsSigner.jwk }
  if (jwsSigner?.method !== 'did') throw new CredoError('Could not resolve kid from signed attachment')

  return { nonce: payload.nonce, kid: jwsSigner.didUrl, publicJwk: jwsSigner.jwk }
}

export function createDidCommSignedAttachmentBindingMethods(
  agentContext: AgentContext,
  options: DidCommSignedAttachmentWithJwkCreateOfferOptions
): DidCommSignedAttachmentBindingMethods {
  const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)

  const algsSupported = options.algsSupported ?? kms.supportedJwaSignatureAlgorithms()
  const didMethodsSupported = options.didMethodsSupported ?? didsApi.supportedResolverMethods

  if (algsSupported.length === 0) throw new CredoError('No supported JWA signature algorithms found.')
  if (didMethodsSupported.length === 0 && !options.jwkSupported) throw new CredoError('No supported DID methods found.')

  return new DidCommSignedAttachmentBindingMethods({
    didcommSignedAttachment: new DidCommSignedAttachmentOfferBindingMethod({
      algsSupported,
      didMethodsSupported,
      jwkSupported: options.jwkSupported,
      nonce: TypedArrayEncoder.toBase64Url(kms.randomBytes({ length: 32 })),
    }),
  })
}

/**
 * Verifies the `didcomm_signed_attachment` binding proof of a request against the offer, and returns the
 * holder to bind the credential to, or `undefined` for a request without a binding proof.
 */
export async function verifyDidCommSignedAttachmentBindingProof(
  agentContext: AgentContext,
  {
    bindingRequired,
    bindingMethod,
    bindingProof,
    appendAttachments,
  }: {
    bindingRequired?: boolean
    bindingMethod?: DidCommSignedAttachmentBindingMethods
    bindingProof?: DidCommSignedAttachmentCredentialRequestBindingProof
    appendAttachments?: DidCommAttachment[]
  }
): Promise<SdJwtVcHolderBinding | undefined> {
  const signedAttachmentProof = bindingProof?.didcomm_signed_attachment
  if (!signedAttachmentProof) {
    if (bindingRequired) throw new CredoError('Binding is required but no binding proof was provided')
    return undefined
  }

  const signedAttachmentMethod = bindingMethod?.didcommSignedAttachment
  if (!signedAttachmentMethod) {
    throw new CredoError('Cannot issue credential with a binding method that was not offered')
  }

  const signedAttachment = appendAttachments?.find(({ id }) => id === signedAttachmentProof.attachment_id)
  if (!signedAttachment) throw new CredoError('Missing binding proof attachment')

  const { nonce, kid, publicJwk } = await verifyDidCommSignedAttachment(agentContext, signedAttachment, {
    algsSupported: signedAttachmentMethod.algsSupported,
    allowedPurposes: ['authentication'],
    didMethodsSupported: signedAttachmentMethod.didMethodsSupported,
    // Applies the RFC 0881 and RFC 0884 `jwk` header rules even when the offer has no `jwk_supported`
    jwkSupported: true,
  })
  if (nonce !== signedAttachmentMethod.nonce) throw new CredoError('Invalid nonce in signed attachment')
  if (!kid && !signedAttachmentMethod.jwkSupported) {
    throw new CredoError("The offer does not accept a 'jwk' binding proof")
  }

  return kid ? { method: 'did', didUrl: kid } : { method: 'jwk', jwk: publicJwk }
}

/**
 * Checks that the `cnf` of an issued credential is the key of the request binding proof, and returns the
 * binding method of that proof, or `undefined` for a request without a binding proof.
 */
export function verifyCnfMatchesDidCommSignedAttachmentBindingProof(
  cnf: unknown,
  {
    bindingProof,
    appendAttachments,
  }: {
    bindingProof?: DidCommSignedAttachmentCredentialRequestBindingProof
    appendAttachments?: DidCommAttachment[]
  }
): SdJwtVcHolderBinding['method'] | undefined {
  const signedAttachmentProof = bindingProof?.didcomm_signed_attachment
  if (!signedAttachmentProof) return undefined

  const jws = appendAttachments?.find(({ id }) => id === signedAttachmentProof.attachment_id)?.data.jws as
    | JwsDetachedFormat
    | undefined
  if (!jws) throw new CredoError('Missing binding proof attachment')
  const { kid, jwk: proofJwk } = JsonEncoder.fromBase64Url(jws.protected)

  if (!isJsonObject(cnf) || Object.keys(cnf).length !== 1) {
    throw new CredoError("The credential must have a 'cnf' claim with exactly one member")
  }
  if (kid !== undefined) {
    if (cnf.kid !== kid) throw new CredoError("The credential 'cnf.kid' is not the key of the binding proof")
    return 'did'
  }

  const { jwk } = cnf
  if (!isJsonObject(jwk) || ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth', 'k', 'x5u'].some((member) => member in jwk)) {
    throw new CredoError("The credential 'cnf.jwk' must be a public JWK without 'x5u'")
  }
  if (!Kms.PublicJwk.fromUnknown(jwk).equals(Kms.PublicJwk.fromUnknown(proofJwk))) {
    throw new CredoError("The credential 'cnf.jwk' is not the key of the binding proof")
  }
  return 'jwk'
}
