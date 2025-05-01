import type { Key, Wallet, X509Certificate } from '@credo-ts/core'
import type { AgentContext } from '../../agent'

import { InMemoryWallet } from '../../../../../tests/InMemoryWallet'
import { getAgentConfig, getAgentContext } from '../../../tests/helpers'
import { DidKey } from '../../modules/dids'
import { JsonEncoder, TypedArrayEncoder } from '../../utils'
import { JwsService } from '../JwsService'
import { KeyType } from '../KeyType'
import { JwaSignatureAlgorithm } from '../jose/jwa'
import { getJwkFromKey } from '../jose/jwk'

import * as didJwsz6Mkf from './__fixtures__/didJwsz6Mkf'
import * as didJwsz6Mkv from './__fixtures__/didJwsz6Mkv'
import * as didJwszDnaey from './__fixtures__/didJwszDnaey'

import { CredoError, X509ModuleConfig, X509Service } from '@credo-ts/core'

describe('JwsService', () => {
  let wallet: Wallet
  let agentContext: AgentContext
  let jwsService: JwsService
  let didJwsz6MkfKey: Key
  let didJwsz6MkfCertificate: X509Certificate
  let didJwsz6MkvKey: Key
  let didJwsz6MkvCertificate: X509Certificate
  let didJwszDnaeyKey: Key

  beforeAll(async () => {
    const config = getAgentConfig('JwsService')
    wallet = new InMemoryWallet()
    agentContext = getAgentContext({
      wallet,
      registerInstances: [[X509ModuleConfig, new X509ModuleConfig()]],
    })
    await wallet.createAndOpen(config.walletConfig)

    jwsService = new JwsService()

    didJwsz6MkfKey = await wallet.createKey({
      privateKey: TypedArrayEncoder.fromString(didJwsz6Mkf.SEED),
      keyType: KeyType.Ed25519,
    })
    didJwsz6MkfCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: didJwsz6MkfKey,
      issuer: {
        countryName: 'NL',
      },
    })

    didJwsz6MkvKey = await wallet.createKey({
      privateKey: TypedArrayEncoder.fromString(didJwsz6Mkv.SEED),
      keyType: KeyType.Ed25519,
    })
    didJwsz6MkvCertificate = await X509Service.createCertificate(agentContext, {
      authorityKey: didJwsz6MkvKey,
      issuer: {
        countryName: 'NL',
      },
    })

    didJwszDnaeyKey = await wallet.createKey({
      privateKey: TypedArrayEncoder.fromString(didJwszDnaey.SEED),
      keyType: KeyType.P256,
    })
  })

  afterAll(async () => {
    await wallet.delete()
  })

  it('creates a jws for the payload using Ed25519 key', async () => {
    const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)
    const kid = new DidKey(didJwsz6MkfKey).did

    const jws = await jwsService.createJws(agentContext, {
      payload,
      key: didJwsz6MkfKey,
      header: { kid },
      protectedHeaderOptions: {
        alg: JwaSignatureAlgorithm.EdDSA,
        jwk: getJwkFromKey(didJwsz6MkfKey),
      },
    })

    expect(jws).toEqual(didJwsz6Mkf.JWS_JSON)
  })

  it('creates and verify a jws using ES256 alg and P-256 kty', async () => {
    const payload = JsonEncoder.toBuffer(didJwszDnaey.DATA_JSON)
    const kid = new DidKey(didJwszDnaeyKey).did

    const jws = await jwsService.createJws(agentContext, {
      payload,
      key: didJwszDnaeyKey,
      header: { kid },
      protectedHeaderOptions: {
        alg: JwaSignatureAlgorithm.ES256,
        jwk: getJwkFromKey(didJwszDnaeyKey),
      },
    })

    expect(jws).toEqual(didJwszDnaey.JWS_JSON)
  })

  it('creates a compact jws', async () => {
    const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)

    const jws = await jwsService.createJwsCompact(agentContext, {
      payload,
      key: didJwsz6MkfKey,
      protectedHeaderOptions: {
        alg: JwaSignatureAlgorithm.EdDSA,
        jwk: getJwkFromKey(didJwsz6MkfKey),
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
      key: didJwsz6MkfKey,
      protectedHeaderOptions: {
        alg: JwaSignatureAlgorithm.EdDSA,
        jwk: getJwkFromKey(didJwsz6MkfKey),
        kid: 'something',
      },
    })
    const { isValid: isValid1 } = await jwsService.verifyJws(agentContext, {
      jws: signed1,
    })
    expect(isValid1).toEqual(true)

    const signed2 = await jwsService.createJwsCompact(agentContext, {
      payload,
      key: didJwsz6MkfKey,
      protectedHeaderOptions: {
        alg: JwaSignatureAlgorithm.EdDSA,
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
          jwk: getJwkFromKey(didJwsz6MkfKey),
          method: 'did',
        },
      })

      expect(isValid).toBe(true)
      expect(jwsSigners).toEqual([
        {
          method: 'did',
          didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
          jwk: getJwkFromKey(didJwsz6MkfKey),
        },
      ])
    })

    it('verifies a compact JWS', async () => {
      const { isValid, jwsSigners } = await jwsService.verifyJws(agentContext, {
        jws: `${didJwsz6Mkf.JWS_JSON.protected}.${didJwsz6Mkf.JWS_JSON.payload}.${didJwsz6Mkf.JWS_JSON.signature}`,
        jwsSigner: {
          didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
          jwk: getJwkFromKey(didJwsz6MkfKey),
          method: 'did',
        },
      })

      expect(isValid).toBe(true)
      expect(jwsSigners).toEqual([
        {
          method: 'did',
          didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
          jwk: getJwkFromKey(didJwsz6MkfKey),
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
              jwk: getJwkFromKey(didJwsz6MkfKey),
              didUrl: `did:key:${didJwsz6MkfKey.fingerprint}#${didJwsz6MkfKey.fingerprint}`,
            }
          }

          if (jws.header.kid === `did:key:${didJwsz6MkvKey.fingerprint}`) {
            return {
              method: 'did',
              jwk: getJwkFromKey(didJwsz6MkvKey),
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
          jwk: getJwkFromKey(didJwsz6MkfKey),
        },
        {
          method: 'did',
          didUrl: `did:key:${didJwsz6MkvKey.fingerprint}#${didJwsz6MkvKey.fingerprint}`,
          jwk: getJwkFromKey(didJwsz6MkvKey),
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
            jwk: getJwkFromKey(didJwsz6MkfKey),
          },
        })
      ).rejects.toThrow("jwsSigner provided with method 'jwk', but allowed jws signer methods are x5c.")
    })

    it('throws an error if provided jws signer does not match the signer of the jws', async () => {
      const { isValid, jwsSigners } = await jwsService.verifyJws(agentContext, {
        jws: didJwsz6Mkf.JWS_JSON,
        jwsSigner: {
          method: 'jwk',
          jwk: getJwkFromKey(didJwsz6MkvKey),
        },
      })

      expect(isValid).toBe(false)
      expect(jwsSigners).toEqual([])
    })

    it('verifies x5c chain for provided jws signer', async () => {
      const payload = JsonEncoder.toBuffer(didJwsz6Mkf.DATA_JSON)

      const signed = await jwsService.createJwsCompact(agentContext, {
        payload,
        key: didJwsz6MkfKey,
        protectedHeaderOptions: {
          alg: JwaSignatureAlgorithm.EdDSA,
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
            jwk: getJwkFromKey(didJwsz6MkfKey),
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
            jwk: getJwkFromKey(didJwsz6MkfKey),
          },
          trustedCertificates: [didJwsz6MkvCertificate.toString('base64url')],
        })
      ).rejects.toThrow('No trusted certificate was found while validating the X.509 chain')
    })
  })
})
