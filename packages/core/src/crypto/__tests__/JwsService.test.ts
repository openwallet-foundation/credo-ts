import type { X509Certificate } from '@credo-ts/core'
import type { AgentContext } from '../../agent'

import { getAgentConfig, getAgentContext, getAskarStoreConfig } from '../../../tests/helpers'
import { DidKey } from '../../modules/dids'
import { JsonEncoder, TypedArrayEncoder } from '../../utils'
import { JwsService } from '../JwsService'

import * as didJwsz6Mkf from './__fixtures__/didJwsz6Mkf'
import * as didJwsz6Mkv from './__fixtures__/didJwsz6Mkv'
import * as didJwszDnaey from './__fixtures__/didJwszDnaey'

import { CredoError, X509ModuleConfig, X509Service } from '@credo-ts/core'
import { askar } from '@openwallet-foundation/askar-nodejs'
import { AskarKeyManagementService, AskarModuleConfig, transformPrivateKeyToPrivateJwk } from '../../../../askar/src'
import { AskarStoreManager } from '../../../../askar/src/AskarStoreManager'
import { NodeFileSystem } from '../../../../node/src/NodeFileSystem'
import {
  Ed25519PublicJwk,
  KeyManagementApi,
  KnownJwaSignatureAlgorithms,
  P256PublicJwk,
  PublicJwk,
} from '../../modules/kms'

// NOTE: we use askar for the KMS in this test since the signatures with the
// node KMS are different, but it does correctly verify. It's probably something
// to do with the encoding of the signature?

describe('JwsService', () => {
  let agentContext: AgentContext
  let jwsService: JwsService
  let didJwsz6MkfKey: PublicJwk<Ed25519PublicJwk>
  let didJwsz6MkfCertificate: X509Certificate
  let didJwsz6MkvKey: PublicJwk<Ed25519PublicJwk>
  let didJwsz6MkvCertificate: X509Certificate
  let didJwszDnaeyKey: PublicJwk<P256PublicJwk>

  beforeAll(async () => {
    agentContext = getAgentContext({
      registerInstances: [
        [X509ModuleConfig, new X509ModuleConfig()],

        [
          AskarStoreManager,
          new AskarStoreManager(
            new NodeFileSystem(),
            new AskarModuleConfig({
              askar,
              store: getAskarStoreConfig('JwsService'),
            })
          ),
        ],
      ],
      kmsBackends: [new AskarKeyManagementService()],
      agentConfig: getAgentConfig('JwsService'),
    })
    const kms = agentContext.resolve(KeyManagementApi)

    jwsService = new JwsService()

    didJwsz6MkfKey = PublicJwk.fromPublicJwk(
      (
        await kms.importKey({
          privateJwk: transformPrivateKeyToPrivateJwk({
            privateKey: TypedArrayEncoder.fromString(didJwsz6Mkf.SEED),
            type: {
              kty: 'OKP',
              crv: 'Ed25519',
            },
          }).privateJwk,
        })
      ).publicJwk
    )

    didJwsz6MkfCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: didJwsz6MkfKey,
      issuer: {
        countryName: 'NL',
      },
    })

    didJwsz6MkvKey = PublicJwk.fromPublicJwk(
      (
        await kms.importKey({
          privateJwk: transformPrivateKeyToPrivateJwk({
            privateKey: TypedArrayEncoder.fromString(didJwsz6Mkv.SEED),
            type: {
              kty: 'OKP',
              crv: 'Ed25519',
            },
          }).privateJwk,
        })
      ).publicJwk
    )

    didJwsz6MkvCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: didJwsz6MkvKey,
      issuer: {
        countryName: 'NL',
      },
    })

    didJwszDnaeyKey = PublicJwk.fromPublicJwk(
      (
        await kms.importKey({
          privateJwk: transformPrivateKeyToPrivateJwk({
            privateKey: TypedArrayEncoder.fromString(didJwszDnaey.SEED),
            type: {
              kty: 'EC',
              crv: 'P-256',
            },
          }).privateJwk,
        })
      ).publicJwk
    )
  })

  it('creates a jws for the payload using Ed25519 key', async () => {
    const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)
    const kid = new DidKey(didJwsz6MkfKey).did

    const jws = await jwsService.createJws(agentContext, {
      payload,
      keyId: didJwsz6MkfKey.keyId,
      header: { kid },
      protectedHeaderOptions: {
        alg: KnownJwaSignatureAlgorithms.EdDSA,
        jwk: didJwsz6MkfKey.toJson({ includeKid: false }),
      },
    })

    expect(jws).toEqual(didJwsz6Mkf.JWS_JSON)
  })

  it('creates and verify a jws using ES256 alg and P-256 kty', async () => {
    const payload = JsonEncoder.toBuffer(didJwszDnaey.DATA_JSON)
    const kid = new DidKey(didJwszDnaeyKey).did

    const jws = await jwsService.createJws(agentContext, {
      payload,
      keyId: didJwszDnaeyKey.keyId,
      header: { kid },
      protectedHeaderOptions: {
        alg: KnownJwaSignatureAlgorithms.ES256,
        jwk: didJwszDnaeyKey.toJson({ includeKid: false }),
      },
    })

    expect(jws).toEqual(didJwszDnaey.JWS_JSON)
  })

  it('creates a compact jws', async () => {
    const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)

    const jws = await jwsService.createJwsCompact(agentContext, {
      payload,
      keyId: didJwsz6MkfKey.keyId,
      protectedHeaderOptions: {
        alg: KnownJwaSignatureAlgorithms.EdDSA,
        jwk: didJwsz6MkfKey.toJson({ includeKid: false }),
      },
    })

    expect(jws).toEqual(
      `${didJwsz6Mkf.JWS_JSON.protected}.${TypedArrayEncoder.toBase64URL(payload)}.${didJwsz6Mkf.JWS_JSON.signature}`
    )
  })

  it('allows both x5c/jwk and kid (no did) to be present', async () => {
    const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)

    const signed1 = await jwsService.createJwsCompact(agentContext, {
      payload,
      keyId: didJwsz6MkfKey.keyId,
      protectedHeaderOptions: {
        alg: KnownJwaSignatureAlgorithms.EdDSA,
        jwk: didJwsz6MkfKey,
        kid: 'something',
      },
    })
    const { isValid: isValid1 } = await jwsService.verifyJws(agentContext, {
      jws: signed1,
    })
    expect(isValid1).toEqual(true)

    const signed2 = await jwsService.createJwsCompact(agentContext, {
      payload,
      keyId: didJwsz6MkfKey.keyId,
      protectedHeaderOptions: {
        alg: KnownJwaSignatureAlgorithms.EdDSA,
        x5c: [didJwsz6MkfCertificate.toString('base64url')],
        kid: 'something',
      },
    })

    const { isValid: isValid2 } = await jwsService.verifyJws(agentContext, {
      jws: signed2,
      trustedCertificates: [didJwsz6MkfCertificate.toString('base64url')],
    })
    expect(isValid2).toEqual(true)
  })

  describe('verifyJws', () => {
    it('returns true if the jws signature matches the payload', async () => {
      const { isValid, jwsSigners } = await jwsService.verifyJws(agentContext, {
        jws: didJwsz6Mkf.JWS_JSON,
        allowedJwsSignerMethods: ['did'],
        jwsSigner: {
          didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
          jwk: didJwsz6MkfKey,
          method: 'did',
        },
      })

      expect(isValid).toBe(true)
      expect(jwsSigners).toEqual([
        {
          method: 'did',
          didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
          jwk: didJwsz6MkfKey,
        },
      ])
    })

    it('verifies a compact JWS', async () => {
      const { isValid, jwsSigners } = await jwsService.verifyJws(agentContext, {
        jws: `${didJwsz6Mkf.JWS_JSON.protected}.${didJwsz6Mkf.JWS_JSON.payload}.${didJwsz6Mkf.JWS_JSON.signature}`,
        jwsSigner: {
          didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
          jwk: didJwsz6MkfKey,
          method: 'did',
        },
      })

      expect(isValid).toBe(true)
      expect(jwsSigners).toEqual([
        {
          method: 'did',
          didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
          jwk: didJwsz6MkfKey,
        },
      ])
    })

    it('returns all keys that signed the jws', async () => {
      const { isValid, jwsSigners } = await jwsService.verifyJws(agentContext, {
        jws: { signatures: [didJwsz6Mkf.JWS_JSON, didJwsz6Mkv.JWS_JSON], payload: didJwsz6Mkf.JWS_JSON.payload },
        allowedJwsSignerMethods: ['did'],
        resolveJwsSigner: ({ jws }) => {
          if (jws.header.kid === `did:key:${didJwsz6MkfKey.fingerprint}`) {
            return {
              method: 'did',
              jwk: didJwsz6MkfKey,
              didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
            }
          }

          if (jws.header.kid === `did:key:${didJwsz6MkvKey.fingerprint}`) {
            return {
              method: 'did',
              jwk: didJwsz6MkvKey,
              didUrl: `did:key:${didJwsz6MkvKey.fingerprint}#${didJwsz6MkvKey.fingerprint}`,
            }
          }

          throw new CredoError('unexpected request')
        },
      })

      expect(isValid).toBe(true)
      expect(jwsSigners).toEqual([
        {
          method: 'did',
          didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
          jwk: didJwsz6MkfKey,
        },
        {
          method: 'did',
          didUrl: `did:key:${didJwsz6MkvKey.fingerprint}#${didJwsz6MkvKey.fingerprint}`,
          jwk: didJwsz6MkvKey,
        },
      ])
    })

    it('returns false if the jws signature does not match the payload', async () => {
      const { isValid, jwsSigners } = await jwsService.verifyJws(agentContext, {
        jws: {
          ...didJwsz6Mkf.JWS_JSON,
          payload: JsonEncoder.toBase64URL({ ...didJwsz6Mkf, did: 'another_did' }),
        },
      })

      expect(isValid).toBe(false)
      expect(jwsSigners).toMatchObject([])
    })

    it('throws an error if the jws signatures array does not contain a JWS', async () => {
      await expect(
        jwsService.verifyJws(agentContext, {
          jws: { signatures: [], payload: '' },
        })
      ).rejects.toThrow('Unable to verify JWS, no signatures present in JWS.')
    })

    it('throws an error if provided jws signer is of different method than allowed jws signer', async () => {
      await expect(
        jwsService.verifyJws(agentContext, {
          allowedJwsSignerMethods: ['x5c'],
          jws: { signatures: [], payload: '' },
          jwsSigner: {
            method: 'jwk',
            jwk: didJwsz6MkfKey,
          },
        })
      ).rejects.toThrow("jwsSigner provided with method 'jwk', but allowed jws signer methods are x5c.")
    })

    it('throws an error if provided jws signer does not match the signer of the jws', async () => {
      const { isValid, jwsSigners } = await jwsService.verifyJws(agentContext, {
        jws: didJwsz6Mkf.JWS_JSON,
        jwsSigner: {
          method: 'jwk',
          jwk: didJwsz6MkvKey,
        },
      })

      expect(isValid).toBe(false)
      expect(jwsSigners).toEqual([])
    })

    it('verifies x5c chain for provided jws signer', async () => {
      const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)

      const signed = await jwsService.createJwsCompact(agentContext, {
        payload,
        keyId: didJwsz6MkfKey.keyId,
        protectedHeaderOptions: {
          alg: KnownJwaSignatureAlgorithms.EdDSA,
          x5c: [didJwsz6MkfCertificate.toString('base64url')],
        },
      })

      const { isValid } = await jwsService.verifyJws(agentContext, {
        jws: signed,
        allowedJwsSignerMethods: ['x5c'],
        trustedCertificates: [didJwsz6MkfCertificate.toString('base64url')],
      })
      expect(isValid).toEqual(true)

      // Invalid cert
      await expect(
        jwsService.verifyJws(agentContext, {
          jws: signed,
          allowedJwsSignerMethods: ['x5c'],
          jwsSigner: {
            method: 'x5c',
            x5c: ['invalid'],
            jwk: didJwsz6MkfKey,
          },
          trustedCertificates: [didJwsz6MkfCertificate.toString('base64url')],
        })
      ).rejects.toThrow('Error during parsing of x509 certificate')

      // No trusted cert
      await expect(
        jwsService.verifyJws(agentContext, {
          jws: signed,
          allowedJwsSignerMethods: ['x5c'],
          jwsSigner: {
            method: 'x5c',
            x5c: [didJwsz6MkfCertificate.toString('base64url')],
            jwk: didJwsz6MkfKey,
          },
          trustedCertificates: [didJwsz6MkvCertificate.toString('base64url')],
        })
      ).rejects.toThrow('No trusted certificate was found while validating the X.509 chain')
    })
  })
})
