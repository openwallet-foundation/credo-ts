import type { OpenId4VcJwtIssuer } from './models'
import type { AgentContext, JwaSignatureAlgorithm, JwsProtectedHeaderOptions, Key } from '@credo-ts/core'
import type { CreateJwtCallback, JwtIssuer, SigningAlgo, VerifyJwtCallback } from '@sphereon/did-auth-siop'
import { X509Certificate } from '../../../core/src/crypto/x509/X509Certificate'
import { X509Service } from '../../../core/src/crypto/x509/X509Service'
import {
  CredoError,
  DidsApi,
  getKeyFromVerificationMethod,
  getJwkClassFromKeyType,
  SignatureSuiteRegistry,
  JwsService,
  JwtPayload,
  getJwkFromKey,
  getJwkFromJson,
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

async function getKeyFromDid(agentContext: AgentContext, didUrl: string) {
  const didsApi = agentContext.dependencyManager.resolve(DidsApi)
  const didDocument = await didsApi.resolveDidDocument(didUrl)
  const verificationMethod = didDocument.dereferenceKey(didUrl, ['authentication'])

  return getKeyFromVerificationMethod(verificationMethod)
}

export function getVerifyJwtCallback(agentContext: AgentContext): VerifyJwtCallback {
  return async (jwtVerifier, jwt) => {
    const jwsService = agentContext.dependencyManager.resolve(JwsService)
    if (jwtVerifier.method === 'did') {
      const key = await getKeyFromDid(agentContext, jwtVerifier.didUrl)
      const jwk = getJwkFromKey(key)

      const res = await jwsService.verifyJws(agentContext, { jws: jwt.raw, jwkResolver: () => jwk })
      return res.isValid
    } else if (jwtVerifier.method === 'x5c' || jwtVerifier.method === 'jwk') {
      const res = await jwsService.verifyJws(agentContext, { jws: jwt.raw })
      return res.isValid
    } else {
      throw new Error(`Unsupported jwt verifier method: '${jwtVerifier.method}'`)
    }
  }
}

export function getCreateJwtCallback(agentContext: AgentContext): CreateJwtCallback {
  return async (jwtIssuer, jwt) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { iss, sub, aud, exp, nbf, iat, jti, ...additionalClaims } = jwt.payload

    const jwsService = agentContext.dependencyManager.resolve(JwsService)

    if (jwtIssuer.method === 'did') {
      const key = await getKeyFromDid(agentContext, jwtIssuer.didUrl)
      const jws = await jwsService.createJwsCompact(agentContext, {
        protectedHeaderOptions: { alg: jwtIssuer.alg, ...jwt.header },
        payload: new JwtPayload({ ...jwt.payload, additionalClaims }),
        key,
      })

      return jws
    } else if (jwtIssuer.method === 'jwk') {
      const key = getJwkFromJson(jwtIssuer.jwk).key
      const jws = await jwsService.createJwsCompact(agentContext, {
        protectedHeaderOptions: jwt.header as JwsProtectedHeaderOptions,
        payload: new JwtPayload({ ...jwt.payload, additionalClaims }),
        key,
      })

      return jws
    } else if (jwtIssuer.method === 'x5c') {
      const key = X509Service.getLeafCertificate(agentContext, { certificateChain: jwtIssuer.chain }).publicKey

      const jws = await jwsService.createJwsCompact(agentContext, {
        protectedHeaderOptions: jwt.header as JwsProtectedHeaderOptions,
        payload: new JwtPayload({ ...jwt.payload, additionalClaims }),
        key,
      })

      return jws
    }

    throw new Error(`Unsupported jwt issuer method '${jwtIssuer.method}'`)
  }
}

export async function openIdTokenIssuerToJwtIssuer(
  agentContext: AgentContext,
  openId4VcTokenIssuer: OpenId4VcJwtIssuer
): Promise<JwtIssuer> {
  if (openId4VcTokenIssuer.method === 'did') {
    const key = await getKeyFromDid(agentContext, openId4VcTokenIssuer.didUrl)
    const _alg = getJwkClassFromKeyType(key.keyType)?.supportedSignatureAlgorithms[0]
    if (!_alg) throw new CredoError(`No supported signature algorithms for key type: ${key.keyType}`)

    return {
      method: openId4VcTokenIssuer.method,
      didUrl: openId4VcTokenIssuer.didUrl,
      alg: _alg as unknown as SigningAlgo,
    }
  }

  return openId4VcTokenIssuer
}

export function getProofTypeFromKey(agentContext: AgentContext, key: Key) {
  const signatureSuiteRegistry = agentContext.dependencyManager.resolve(SignatureSuiteRegistry)

  const supportedSignatureSuites = signatureSuiteRegistry.getAllByKeyType(key.keyType)
  if (supportedSignatureSuites.length === 0) {
    throw new CredoError(`Couldn't find a supported signature suite for the given key type '${key.keyType}'.`)
  }

  return supportedSignatureSuites[0].proofType
}
