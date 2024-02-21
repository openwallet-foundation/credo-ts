import type { OpenId4VcJwtIssuer } from './models'
import type { AgentContext, JwaSignatureAlgorithm, Key } from '@credo-ts/core'
import type { DIDDocument, SigningAlgo, SuppliedSignature } from '@sphereon/did-auth-siop'

import {
  CredoError,
  DidsApi,
  TypedArrayEncoder,
  getKeyFromVerificationMethod,
  getJwkClassFromKeyType,
  SignatureSuiteRegistry,
} from '@credo-ts/core'

/**
 * Returns the JWA Signature Algorithms that are supported by the wallet.
 *
 * This is an approximation based on the supported key types of the wallet.
 * This is not 100% correct as a supporting a key type does not mean you support
 * all the algorithms for that key type. However, this needs refactoring of the wallet
 * that is planned for the 0.5.0 release.
 */
export function getSupportedJwaSignatureAlgorithms(agentContext: AgentContext): JwaSignatureAlgorithm[] {
  const supportedKeyTypes = agentContext.wallet.supportedKeyTypes

  // Extract the supported JWS algs based on the key types the wallet support.
  const supportedJwaSignatureAlgorithms = supportedKeyTypes
    // Map the supported key types to the supported JWK class
    .map(getJwkClassFromKeyType)
    // Filter out the undefined values
    .filter((jwkClass): jwkClass is Exclude<typeof jwkClass, undefined> => jwkClass !== undefined)
    // Extract the supported JWA signature algorithms from the JWK class
    .flatMap((jwkClass) => jwkClass.supportedSignatureAlgorithms)

  return supportedJwaSignatureAlgorithms
}

export async function getSphereonSuppliedSignatureFromJwtIssuer(
  agentContext: AgentContext,
  jwtIssuer: OpenId4VcJwtIssuer
): Promise<SuppliedSignature> {
  let key: Key
  let alg: string
  let kid: string | undefined
  let did: string | undefined

  if (jwtIssuer.method === 'did') {
    const didsApi = agentContext.dependencyManager.resolve(DidsApi)
    const didDocument = await didsApi.resolveDidDocument(jwtIssuer.didUrl)
    const verificationMethod = didDocument.dereferenceKey(jwtIssuer.didUrl, ['authentication'])

    // get the key from the verification method and use the first supported signature algorithm
    key = getKeyFromVerificationMethod(verificationMethod)
    const _alg = getJwkClassFromKeyType(key.keyType)?.supportedSignatureAlgorithms[0]
    if (!_alg) throw new CredoError(`No supported signature algorithms for key type: ${key.keyType}`)

    alg = _alg
    kid = verificationMethod.id
    did = verificationMethod.controller
  } else {
    throw new CredoError(`Unsupported jwt issuer method '${jwtIssuer.method as string}'. Only 'did' is supported.`)
  }

  return {
    signature: async (data: string | Uint8Array) => {
      if (typeof data !== 'string') throw new CredoError("Expected string but received 'Uint8Array'")
      const signedData = await agentContext.wallet.sign({
        data: TypedArrayEncoder.fromString(data),
        key,
      })

      const signature = TypedArrayEncoder.toBase64URL(signedData)
      return signature
    },
    alg: alg as unknown as SigningAlgo,
    did,
    kid,
  }
}

export function getSphereonDidResolver(agentContext: AgentContext) {
  return {
    resolve: async (didUrl: string) => {
      const didsApi = agentContext.dependencyManager.resolve(DidsApi)
      const result = await didsApi.resolve(didUrl)

      return {
        ...result,
        didDocument: result.didDocument?.toJSON() as DIDDocument,
      }
    },
  }
}

export function getProofTypeFromKey(agentContext: AgentContext, key: Key) {
  const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

  const supportedSignatureSuites = signatureSuiteRegistry.getAllByKeyType(key.keyType)
  if (supportedSignatureSuites.length === 0) {
    throw new CredoError(`Couldn't find a supported signature suite for the given key type '${key.keyType}'.`)
  }

  return supportedSignatureSuites[0].proofType
}
