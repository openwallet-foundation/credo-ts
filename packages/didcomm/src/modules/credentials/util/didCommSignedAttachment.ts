import type { AgentContext, DidPurpose, JwsDetachedFormat, XOR } from '@credo-ts/core'
import {
  CredoError,
  DidsApi,
  getPublicJwkFromVerificationMethod,
  JsonEncoder,
  JwsService,
  JwtPayload,
  Kms,
  parseDid,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { DidCommAttachment, DidCommAttachmentData } from '../../../decorators/attachment/DidCommAttachment'

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
      base64: TypedArrayEncoder.toBase64(TypedArrayEncoder.fromBase64Url(jws.payload)),
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
