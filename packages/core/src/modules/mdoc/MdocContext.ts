import type { AgentContext } from '../../agent'
import type { JwkJson } from '../../crypto'
import type { MdocContext, X509Context } from '@protokoll/mdoc-client'

import { p256 } from '@noble/curves/p256'
import { hkdf } from '@noble/hashes/hkdf'
import { sha256 } from '@noble/hashes/sha2'
import * as x509 from '@peculiar/x509'
import { exportJwk, importX509, verifyWithJwk } from '@protokoll/crypto'

import { CredoWebCrypto, getJwkFromJson, Hasher } from '../../crypto'
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
          const { data, signature, alg } = mac0.getRawVerificationData(options)
          return await verifyWithJwk({ jwk, signature, data, alg })
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
          const { data, signature, alg } = sign1.getRawVerificationData(options)
          return await verifyWithJwk({ jwk, signature, data, alg, crypto })
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
        const certificate = new x509.X509Certificate(input.certificate)
        const key = await importX509({
          x509: certificate.toString(),
          alg: input.alg,
          extractable: true,
        })

        // TODO: Key length missmatch
        //expected
        //{
        //kty: 'EC',
        //x: 'OFBq4YMKg4w5fTifsytwBuJf_7E7VhRPXiNm52S3q1E',
        //y: 'EyIAXV8gyt5FcRsYHhz4ryz97rjL0uogxHO6jMZr3bg',
        //crv: 'P-256'
        //}

        //actual
        //{
        //kty: 'EC',
        //crv: 'P-256',
        //x: 'OFBq4YMKg4w5fTifsytwBuJf_7E7VhRPXiNm52S3q1ETIgBdXyDK3kVxGxgeHPiv',
        //y: 'LP3uuMvS6iDEc7qMxmvduNeBp_oWscK1x-3_1KKYDayIctdDcpXHi8HcbehAfVIK'
        //}

        //const comp = X509Certificate.fromRawCertificate(input.certificate)
        //const x = getJwkFromKey(comp.publicKey).toJson()
        //// eslint-disable-next-line @typescript-eslint/no-unused-vars
        //const { use, ...jwk } = x
        //return jwk

        return (await exportJwk({ key })) as JwkJson
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
        return x509Certificate.getData(crypto)
      },
    } satisfies X509Context,
  }
}
