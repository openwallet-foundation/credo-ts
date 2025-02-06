import type { AgentContext } from '../../agent'
import type { JwkJson } from '../../crypto'
import type { MdocContext, X509Context } from '@animo-id/mdoc'

import { p256 } from '@noble/curves/p256'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'

import { CredoWebCrypto, getJwkFromJson, getJwkFromKey, Hasher } from '../../crypto'
import { Buffer, TypedArrayEncoder } from '../../utils'
import { X509Certificate, X509Service } from '../x509'

export const getMdocContext = (agentContext: AgentContext): MdocContext => {
  const crypto = new CredoWebCrypto(agentContext)
  return {
    crypto: {
      digest: async (input) => {
        const { bytes, digestAlgorithm } = input
        return new Uint8Array(crypto.digest(digestAlgorithm, bytes))
      },
      random: (length) => {
        return crypto.getRandomValues(new Uint8Array(length))
      },
      calculateEphemeralMacKeyJwk: async (input) => {
        const { privateKey, publicKey, sessionTranscriptBytes } = input
        const ikm = p256
          .getSharedSecret(TypedArrayEncoder.toHex(privateKey), TypedArrayEncoder.toHex(publicKey), true)
          .slice(1)
        const salt = Hasher.hash(sessionTranscriptBytes, 'sha-256')
        const info = Buffer.from('EMacKey', 'utf-8')
        const hk1 = hkdf(sha256, ikm, salt, info, 32)

        return {
          key_ops: ['sign', 'verify'],
          ext: true,
          kty: 'oct',
          k: TypedArrayEncoder.toBase64URL(hk1),
          alg: 'HS256',
        }
      },
    },

    cose: {
      mac0: {
        sign: async (input) => {
          const { jwk, mac0 } = input
          const { data } = mac0.getRawSigningData()
          return await agentContext.wallet.sign({
            data: Buffer.from(data),
            key: getJwkFromJson(jwk as JwkJson).key,
          })
        },
        verify: async (input) => {
          const { mac0, jwk, options } = input
          const { data, signature } = mac0.getRawVerificationData(options)
          return await agentContext.wallet.verify({
            key: getJwkFromJson(jwk as JwkJson).key,
            data: Buffer.from(data),
            signature: new Buffer(signature),
          })
        },
      },
      sign1: {
        sign: async (input) => {
          const { jwk, sign1 } = input
          const { data } = sign1.getRawSigningData()
          return await agentContext.wallet.sign({
            data: Buffer.from(data),
            key: getJwkFromJson(jwk as JwkJson).key,
          })
        },
        verify: async (input) => {
          const { sign1, jwk, options } = input
          const { data, signature } = sign1.getRawVerificationData(options)
          return await agentContext.wallet.verify({
            key: getJwkFromJson(jwk as JwkJson).key,
            data: Buffer.from(data),
            signature: new Buffer(signature),
          })
        },
      },
    },

    x509: {
      getIssuerNameField: (input) => {
        const { certificate, field } = input
        const x509Certificate = X509Certificate.fromRawCertificate(certificate)
        return x509Certificate.getIssuerNameField(field)
      },
      getPublicKey: async (input) => {
        const comp = X509Certificate.fromRawCertificate(input.certificate)
        return getJwkFromKey(comp.publicKey).toJson()
      },
      validateCertificateChain: async (input) => {
        const certificateChain = input.x5chain.map((cert) => X509Certificate.fromRawCertificate(cert).toString('pem'))
        const trustedCertificates = input.trustedCertificates.map((cert) =>
          X509Certificate.fromRawCertificate(cert).toString('pem')
        ) as [string, ...string[]]

        await X509Service.validateCertificateChain(agentContext, {
          certificateChain,
          trustedCertificates,
        })
      },
      getCertificateData: async (input) => {
        const { certificate } = input
        const x509Certificate = X509Certificate.fromRawCertificate(certificate)
        return {
          ...x509Certificate.data,
          thumbprint: await x509Certificate.getThumprint(agentContext),
        }
      },
    } satisfies X509Context,
  }
}
