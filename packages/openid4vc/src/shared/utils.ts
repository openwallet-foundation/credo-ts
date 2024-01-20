import type { AgentContext, VerificationMethod, JwaSignatureAlgorithm, Key } from '@aries-framework/core'
import type { DIDDocument, SigningAlgo } from '@sphereon/did-auth-siop'

import {
  AriesFrameworkError,
  DidsApi,
  TypedArrayEncoder,
  getKeyFromVerificationMethod,
  getJwkClassFromKeyType,
  SignatureSuiteRegistry,
} from '@aries-framework/core'

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

export function getSupportedDidMethods(agentContext: AgentContext) {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const supportedDidMethods: Set<string> = new Set()

  for (const resolver of didsApi.config.resolvers) {
    resolver.supportedMethods.forEach((method) => supportedDidMethods.add(method))
  }

  return Array.from(supportedDidMethods)
}

export async function getSuppliedSignatureFromVerificationMethod(
  agentContext: AgentContext,
  verificationMethod: VerificationMethod
) {
  // get the key from the verification method and use the first supported signature algorithm
  const key = getKeyFromVerificationMethod(verificationMethod)
  const alg = getJwkClassFromKeyType(key.keyType)?.supportedSignatureAlgorithms[0]
  if (!alg) throw new AriesFrameworkError(`No supported signature algorithms for key type: ${key.keyType}`)

  const suppliedSignature = {
    signature: async (data: string | Uint8Array) => {
      if (typeof data !== 'string') throw new AriesFrameworkError("Expected string but received 'Uint8Array'")
      const signedData = await agentContext.wallet.sign({
        data: TypedArrayEncoder.fromString(data),
        key,
      })

      const signature = TypedArrayEncoder.toBase64URL(signedData)
      return signature
    },
    alg: alg as unknown as SigningAlgo,
    did: verificationMethod.controller,
    kid: verificationMethod.id,
  }

  return suppliedSignature
}

export function getResolver(agentContext: AgentContext) {
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

export const getProofTypeFromKey = (agentContext: AgentContext, key: Key) => {
  const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

  const supportedSignatureSuites = signatureSuiteRegistry.getByKeyType(key.keyType)
  if (supportedSignatureSuites.length === 0) {
    throw new AriesFrameworkError(`Couldn't find a supported signature suite for the given key type '${key.keyType}'.`)
  }

  return supportedSignatureSuites[0].proofType
}
