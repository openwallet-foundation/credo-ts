import { Buffer } from 'node:buffer'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { JsonEncoder, Kms, TypedArrayEncoder, ZodValidationError } from '@credo-ts/core'
import { getAgentContext } from '../../../../core/tests'
import { NodeInMemoryKeyManagementStorage } from '../NodeInMemoryKeyManagementStorage'
import { NodeKeyManagementService } from '../NodeKeyManagementService'

const agentContext = getAgentContext({ contextCorrelationId: 'default' })
const agentContextTenant = getAgentContext({ contextCorrelationId: 'd5d0141d-9456-49ec-9c52-338d2f4a7c60' })

describe('NodeKeyManagementService', () => {
  let service: NodeKeyManagementService
  let storage: NodeInMemoryKeyManagementStorage

  beforeEach(() => {
    storage = new NodeInMemoryKeyManagementStorage()
    service = new NodeKeyManagementService(storage)
  })

  it('correctly identifies backend as node', () => {
    expect(service.backend).toBe('node')
  })

  describe('tenants', () => {
    it('automatically handles new context correlation ids', async () => {
      const { publicJwk } = await service.createKey(agentContextTenant, {
        type: { kty: 'EC', crv: 'P-256' },
        keyId: 'key-1',
      })

      expect(await storage.get(agentContext, 'key-1')).toBeNull()
      expect(await storage.get(agentContextTenant, 'key-1')).toEqual({
        ...publicJwk,
        d: expect.any(String),
      })
    })
  })

  describe('createKey', () => {
    it('throws error if key id already exists', async () => {
      const keyId = 'test-key'
      await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
        keyId,
      })

      await expect(
        service.createKey(agentContext, {
          type: { kty: 'EC', crv: 'P-256' },
          keyId,
        })
      ).rejects.toThrow(new Kms.KeyManagementKeyExistsError('test-key', service.backend))
    })

    it('creates EC P-256 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'EC',
          crv: 'P-256',
          x: expect.any(String),
          y: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates EC P-384 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-384' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'EC',
          crv: 'P-384',
          x: expect.any(String),
          y: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates EC P-521 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-521' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'EC',
          crv: 'P-521',
          x: expect.any(String),
          y: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates EC secp256k1 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'secp256k1' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'EC',
          crv: 'secp256k1',
          x: expect.any(String),
          y: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates RSA key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'RSA',
          n: expect.any(String),
          e: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates OKP Ed25519 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'Ed25519' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'OKP',
          crv: 'Ed25519',
          x: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates OKP X25519 key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'X25519' },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'OKP',
          crv: 'X25519',
          x: expect.any(String),
          kid: result.keyId,
        },
      })
    })

    it('creates oct aes key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'aes', length: 256 },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'oct',
          kid: result.keyId,
        },
      })
    })

    it('creates oct hmac key successfully', async () => {
      const result = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 512 },
      })

      const publicJwk = await service.getPublicKey(agentContext, result.keyId)
      expect(result.publicJwk).toEqual(publicJwk)

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kty: 'oct',
          kid: result.keyId,
        },
      })
    })

    it('throws error for unsupported oct C20P key', async () => {
      await expect(
        service.createKey(agentContext, {
          type: { kty: 'oct', algorithm: 'C20P' },
        })
      ).rejects.toThrow(
        new Kms.KeyManagementAlgorithmNotSupportedError(`algorithm 'C20P' for kty 'oct'`, service.backend)
      )
    })

    it('throws error for unsupported key type', async () => {
      await expect(
        service.createKey(agentContext, {
          // @ts-expect-error Testing invalid type
          type: { kty: 'INVALID' },
        })
      ).rejects.toThrow(new Kms.KeyManagementAlgorithmNotSupportedError(`kty 'INVALID'`, service.backend))
    })
  })

  describe('sign', () => {
    it('throws error if key is not found', async () => {
      await expect(
        service.sign(agentContext, {
          keyId: 'nonexistent',
          algorithm: 'RS256',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(new Kms.KeyManagementKeyNotFoundError('nonexistent', service.backend))
    })

    it('signs with RS256', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'RS256',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with RS384', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 3072 },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'RS384',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with RS512', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 4096 },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'RS512',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with PS256', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'PS256',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with PS384', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 3072 },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'PS384',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with PS512', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 4096 },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'PS512',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('throws error when signing with PS512 but key has bit length shorter than 4096', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 3072 },
      })

      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'PS512',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `RSA key with bit length 3072 cannot be used with algorithm 'PS512' for signature creation or verification. Allowed algs are 'PS256', 'RS256', 'RS384', 'PS384'`
        )
      )
    })

    it('signs with ES256', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES256',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with ES384', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-384' },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES384',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with ES512', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-521' },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES512',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('throws error when signing with ES512 but key is for P-384', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-384' },
      })

      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'ES512',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `EC key with crv 'P-384' cannot be used with algorithm 'ES512' for signature creation or verification. Allowed algs are 'ES384'`
        )
      )
    })

    it('signs with ES256K', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'secp256k1' },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES256K',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with EdDSA using Ed25519 key', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'Ed25519' },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'EdDSA',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('throws error when signing with x25519 key', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'X25519' },
      })

      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'EdDSA',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `OKP key with crv 'X25519' cannot be used with algorithm 'EdDSA' for signature creation or verification.`
        )
      )
    })

    it('signs with HS256', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 256 },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'HS256',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with HS384', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 384 },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'HS384',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('signs with HS512', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 512 },
      })

      const result = await service.sign(agentContext, {
        keyId,
        algorithm: 'HS512',
        data: new Uint8Array([1, 2, 3]),
      })

      expect(result).toEqual({
        signature: expect.any(Uint8Array),
      })
    })

    it('throws error when signing with HS512 but key has bit length shorter than 512', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 384 },
      })

      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'HS512',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `oct key cannot be used with algorithm 'HS512' for signature creation or verification. Allowed algs are 'HS256', 'HS384'`
        )
      )
    })

    it('throws error if RSA key type does not match algorithm', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 4096 },
      })

      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'ES256',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `RSA key with bit length 4096 cannot be used with algorithm 'ES256' for signature creation or verification. Allowed algs are 'PS256', 'RS256', 'RS384', 'PS384', 'RS512', 'PS512'`
        )
      )
    })

    it('throws error if EC key type does not match algorithm', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'RS256',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `EC key with crv 'P-256' cannot be used with algorithm 'RS256' for signature creation or verification. Allowed algs are 'ES256'`
        )
      )
    })
  })

  describe('verify', () => {
    it('throws error if key is not found', async () => {
      await expect(
        service.verify(agentContext, {
          key: { keyId: 'nonexistent' },
          algorithm: 'RS256',
          data: new Uint8Array([1, 2, 3]),
          signature: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(new Kms.KeyManagementKeyNotFoundError('nonexistent', service.backend))
    })

    it('verifies RS256 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'RS256',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { publicJwk },
        algorithm: 'RS256',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'RS256',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies RS384 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 3072 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'RS384',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { publicJwk },
        algorithm: 'RS384',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'RS384',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies RS512 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 4096 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'RS512',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { publicJwk },
        algorithm: 'RS512',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'RS512',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('throws error when verifying with RS512 but key has bit length shorter than 4096', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      await expect(
        service.verify(agentContext, {
          key: { keyId },
          signature: new Uint8Array([1, 2, 3]),
          algorithm: 'RS512',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `RSA key with bit length 2048 cannot be used with algorithm 'RS512' for signature creation or verification. Allowed algs are 'PS256', 'RS256'`
        )
      )
    })

    it('verifies PS256 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'PS256',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'PS256',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'PS256',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies PS384 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 3072 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'PS384',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'PS384',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'PS384',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies PS512 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 4096 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'PS512',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'PS512',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'PS512',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies ES256 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES256',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { publicJwk },
        algorithm: 'ES256',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'ES256',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies ES384 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-384' },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES384',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { publicJwk },
        algorithm: 'ES384',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'ES384',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies ES512 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-521' },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'ES512',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { publicJwk },
        algorithm: 'ES512',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'ES512',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('throws error when verifying with HS512 but key has bit length shorter than 512', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 384 },
      })

      await expect(
        service.verify(agentContext, {
          key: { keyId },
          signature: new Uint8Array([1, 2, 3]),
          algorithm: 'HS512',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `oct key cannot be used with algorithm 'HS512' for signature creation or verification. Allowed algs are 'HS256', 'HS384'`
        )
      )
    })

    it('verifies ECDSA Ed25519 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'Ed25519' },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'EdDSA',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { publicJwk },
        algorithm: 'EdDSA',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'EdDSA',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies HS256 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 256 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'HS256',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'HS256',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'HS256',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies HS384 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 384 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'HS384',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'HS384',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'HS384',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('verifies HS512 signature', async () => {
      const { keyId, publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 512 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'HS512',
        data,
      })

      const result = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'HS512',
        data,
        signature,
      })

      expect(result).toEqual({ verified: true, publicJwk })

      // Test invalid signature
      const invalidSignature = new Uint8Array(signature.length)
      signature.forEach((byte, i) => {
        invalidSignature[i] = byte ^ 0xff
      })

      const invalidResult = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'HS512',
        data,
        signature: invalidSignature,
      })

      expect(invalidResult).toEqual({ verified: false })
    })

    it('throws error if key type does not match algorithm', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      await expect(
        service.verify(agentContext, {
          key: { keyId },
          algorithm: 'RS256',
          data: new Uint8Array([1, 2, 3]),
          signature: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        new Kms.KeyManagementError(
          `EC key with crv 'P-256' cannot be used with algorithm 'RS256' for signature creation or verification. Allowed algs are 'ES256'`
        )
      )
    })

    it('throws error for x25519 key', async () => {
      const { publicJwk } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'X25519' },
      })

      await expect(
        service.verify(agentContext, {
          key: { publicJwk },
          algorithm: 'EdDSA',
          data: new Uint8Array([1, 2, 3]),
          signature: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(
        `OKP key with crv 'X25519' cannot be used with algorithm 'EdDSA' for signature creation or verification.`
      )
    })

    it('returns false for modified data', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      const data = new Uint8Array([1, 2, 3])
      const { signature } = await service.sign(agentContext, {
        keyId,
        algorithm: 'RS256',
        data,
      })

      const modifiedData = new Uint8Array([1, 2, 4])
      const result = await service.verify(agentContext, {
        key: { keyId },
        algorithm: 'RS256',
        data: modifiedData,
        signature,
      })

      expect(result).toEqual({ verified: false })
    })
  })

  describe('decrypt', () => {
    it('decrypts with A128GCM', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'aes', length: 128 },
      })

      const iv = randomBytes(12)
      const { encrypted, tag } = await service.encrypt(agentContext, {
        key: { keyId },
        encryption: {
          algorithm: 'A128GCM',
          iv,
        },
        data: Buffer.from('heelllo', 'utf-8'),
      })

      const { data } = await service.decrypt(agentContext, {
        key: { keyId },
        decryption: {
          algorithm: 'A128GCM',
          iv,
          tag: tag as Uint8Array,
        },
        encrypted,
      })

      expect(Buffer.from(data).toString('utf-8')).toEqual('heelllo')
    })

    it('decrypts with A192GCM', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'aes', length: 192 },
      })

      const iv = randomBytes(12)
      const { encrypted, tag } = await service.encrypt(agentContext, {
        key: { keyId },
        encryption: {
          algorithm: 'A192GCM',
          iv,
        },
        data: Buffer.from('heelllo', 'utf-8'),
      })

      const { data } = await service.decrypt(agentContext, {
        key: { keyId },
        decryption: {
          algorithm: 'A192GCM',
          iv,
          tag: tag as Uint8Array,
        },
        encrypted,
      })

      expect(Buffer.from(data).toString('utf-8')).toEqual('heelllo')
    })

    it('decrypts with A256GCM', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'aes', length: 256 },
      })

      const iv = randomBytes(12)
      const { encrypted, tag } = await service.encrypt(agentContext, {
        key: { keyId },
        encryption: {
          algorithm: 'A256GCM',
          iv,
        },
        data: Buffer.from('heelllo', 'utf-8'),
      })

      const { data } = await service.decrypt(agentContext, {
        key: { keyId },
        decryption: {
          algorithm: 'A256GCM',
          iv,
          tag: tag as Uint8Array,
        },
        encrypted,
      })

      expect(Buffer.from(data).toString('utf-8')).toEqual('heelllo')
    })

    it('decrypts with A128CBC-HS256', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'aes', length: 256 },
      })

      const iv = randomBytes(16)
      const { encrypted, tag } = await service.encrypt(agentContext, {
        key: { keyId },
        encryption: {
          algorithm: 'A128CBC-HS256',
          iv,
        },
        data: Buffer.from('heelllo', 'utf-8'),
      })

      const { data } = await service.decrypt(agentContext, {
        key: { keyId },
        decryption: {
          algorithm: 'A128CBC-HS256',
          iv,
          tag: tag as Uint8Array,
        },
        encrypted,
      })

      expect(Buffer.from(data).toString('utf-8')).toEqual('heelllo')
    })

    it('decrypts JWE using ECDH-ES and A256GCM based on test vector from OpenID Conformance test', async () => {
      const {
        compactJwe,
        decodedPayload,
        privateKeyJwk,
        header: expectedHeader,
      } = JSON.parse(
        readFileSync(path.join(__dirname, '../__fixtures__/jarm-jwe-encrypted-response.json')).toString('utf-8')
      ) as {
        compactJwe: string
        decodedPayload: Record<string, unknown>
        privateKeyJwk: Kms.KmsJwkPrivate
        header: string
      }

      const [encodedHeader /* encryptionKey */, , encodedIv, encodedCiphertext, encodedTag] = compactJwe.split('.')
      const header = JsonEncoder.fromBase64(encodedHeader)

      const recipientKey = await service.importKey(agentContext, { privateJwk: privateKeyJwk })
      const { data } = await service.decrypt(agentContext, {
        decryption: {
          algorithm: 'A256GCM',
          iv: TypedArrayEncoder.fromBase64(encodedIv),
          tag: TypedArrayEncoder.fromBase64(encodedTag),
          aad: TypedArrayEncoder.fromString(encodedHeader),
        },
        key: {
          keyAgreement: {
            algorithm: 'ECDH-ES',
            keyId: recipientKey.keyId,
            externalPublicJwk: header.epk,
            apu: TypedArrayEncoder.fromBase64(header.apu),
            apv: TypedArrayEncoder.fromBase64(header.apv),
          },
        },
        encrypted: TypedArrayEncoder.fromBase64(encodedCiphertext),
      })

      expect(header).toEqual(expectedHeader)
      expect(JsonEncoder.fromBuffer(data)).toEqual(decodedPayload)
    })
  })

  describe('getPublicKey', () => {
    it('returns null if key does not exist', async () => {
      const result = await service.getPublicKey(agentContext, 'nonexistent')
      expect(result).toBeNull()
    })

    it('returns public key for RSA key pair', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      const publicKey = await service.getPublicKey(agentContext, keyId)

      // Should not contain private key (d, p, q, dp, dq, qi) components
      expect(publicKey).toEqual({
        kid: keyId,
        kty: 'RSA',
        // Public key should have n (modulus) and e (exponent)
        n: expect.any(String),
        e: expect.any(String),
      })
    })

    it('returns public key for EC key pair', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'EC', crv: 'P-256' },
      })

      const publicKey = await service.getPublicKey(agentContext, keyId)

      // Should not contain private key (d) component
      expect(publicKey).toEqual({
        kid: keyId,
        kty: 'EC',
        crv: 'P-256',
        // Public key should have x and y coordinates
        x: expect.any(String),
        y: expect.any(String),
      })
    })

    it('returns public key for Ed25519 key pair', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'OKP', crv: 'Ed25519' },
      })

      const publicKey = await service.getPublicKey(agentContext, keyId)

      // Should not contain private key (d) component
      expect(publicKey).toEqual({
        kid: keyId,
        kty: 'OKP',
        crv: 'Ed25519',
        // Public key should have x coordinate
        x: expect.any(String),
      })
    })

    it('returns no key material for symmetric keys', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'oct', algorithm: 'hmac', length: 256 },
      })

      const key = await service.getPublicKey(agentContext, keyId)

      // Should not contain private key (k) component
      expect(key).toEqual({
        kid: keyId,
        kty: 'oct',
      })
    })
  })

  describe('importKey', () => {
    it('imports RSA key pair with 2048 bit length with provided keyId', async () => {
      const keyId = 'test-key-id'
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kid: keyId,
          p: '8zBiIsI0_zkkHPqBKiajbKFktWs4b00sB29wx9Q1t2mY59hxka5aqrC2OdzlemEQimSKvnx6729CQd4PAU6mlMDaryS-3eiddJ7f-DoVpytpmaFvsrhsad6KwdOYf2IvjHnLIVTli5asS6Ec-aeXRi9VpJH1nM__eY5otbQfwq0',
          kty: 'RSA',
          q: '1EWuwEEdZZPi27yxOBJfvmo6eXzaGqvryEg1nm0hfdVKGI32dxEQabzvDUFNHdlvp2pDYs7_NdNfsKYFH9z0vsmvWt9q5whc73fvCMw3I9ryB3uAq9mrpH2m4JyvaDnCmPGD3cvTmpe-0_l9px23LASRnWdeKKjJy3dM1bb4fFc',
          d: 'JCjUWV7EcxEwcXMSTjGQ9F_dNEtRAPgNMX2QQs8pwZ5hGzLWYtnvt4m_xA6jxGjJtOBLrdOopOgT7eIacA1DluXGG58CJ40LzXeilctpHYq5isnBYU5ZhwH1E_QQwbUGlNnyYtFhTWRFXDStZNRNRQL6fm_jcn86HC6VRlQ9zkMlld5cqClbCRMC-neloO2CYOJxb24Vfts86iuxj699mAZBXD78tR3FCxsmYo-QhgZpGUHm5qWfdqQkXNJ5K9XCRFEMnjjW6LPbkteSZlsQzgJMl1p-Q50q9JAedBqaG-ovtW6rvMPEu1CfAtx4myH7oia45lCgt6697_xK2UflQQ',
          e: 'AQAB',
          qi: 'O8L2RkhvxNIJxCJjXM0eP3XhMFIhEUpfYOPyaYT9sqWoDBQI1V9-GXM5yewuNfdM0DdpgtrwFx55V9-dNfUK7gIvV9mY4UhLnUeIBQJHpaMv-wTz5MMsn6Z3zGVduX29iQw-xJgy6wEKBvt7lNO0fGTfHZqZD6JZGrxuVU63-0g',
          dp: 'a1fv-We__Og8CI6KdRCZElorGek5_-cQiDeokIwbKdpyo-PmPWe4nZ9i0CexI1O0-WFn3K0VlpqFpI1gEjOlVAPMg4K0vT7wQYnfUrJQ3HlNI4MeysSdFh4lIWlE5vVwB5G7F_thVzwq0TdMkuZm35QFOZ8zywQEwKMblRjs7AE',
          dq: 'Vjv4wiGxz5JElwAQ_rZ4LuL43mHaOPuezb6ICdRLxtLfRxplBfnosQwQEVJ2AapTsa95sKpnA3bbaOgJLOiWhOtqUYBx7Wl4V9BhSzGrNOW9bUy--RF0qV5ibN06ZR0R8RAsge5MCIGdBIBWi42G3Fr-zPMxTVNEp2PP0wKB8AE',
          n: 'yaZDUMEKq5pNx_ZSoXTqWIvMKJ2nZA2NihSaD6vti2riwd9FqC0EY4oBWKr0CrrGRC63SgywMo2ywTh4SsErIojo2kuVfaFFadsOaIRri1LuhN08tkdWYSSvcUybOXXPxMKkFxXfjzITLg0a3sBwFUQgyxMJScYRrOOgQm3hCOpWNX-aIv7QjTPYxQVssPotn9rVX5wk1K_a_QWhlH1QPyUUUjLnNA7Dwt3yjEpcwCQpb4u8wQhOp5zI4weJ3mHzY-yFYd0z-9fOBA5gpxglUbWbvymm2cr_lcT09Z56IuxMy6TDFIOB05EqIsiJPGNU12sSKO-Ly7nh1gIcLq70yw',
        },
      })

      expect(result).toEqual({
        keyId,
        publicJwk: {
          kid: keyId,
          kty: 'RSA',
          e: 'AQAB',
          n: 'yaZDUMEKq5pNx_ZSoXTqWIvMKJ2nZA2NihSaD6vti2riwd9FqC0EY4oBWKr0CrrGRC63SgywMo2ywTh4SsErIojo2kuVfaFFadsOaIRri1LuhN08tkdWYSSvcUybOXXPxMKkFxXfjzITLg0a3sBwFUQgyxMJScYRrOOgQm3hCOpWNX-aIv7QjTPYxQVssPotn9rVX5wk1K_a_QWhlH1QPyUUUjLnNA7Dwt3yjEpcwCQpb4u8wQhOp5zI4weJ3mHzY-yFYd0z-9fOBA5gpxglUbWbvymm2cr_lcT09Z56IuxMy6TDFIOB05EqIsiJPGNU12sSKO-Ly7nh1gIcLq70yw',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, keyId)
      expect(storedKey).toEqual({
        kid: keyId,
        kty: 'RSA',
        e: 'AQAB',
        n: 'yaZDUMEKq5pNx_ZSoXTqWIvMKJ2nZA2NihSaD6vti2riwd9FqC0EY4oBWKr0CrrGRC63SgywMo2ywTh4SsErIojo2kuVfaFFadsOaIRri1LuhN08tkdWYSSvcUybOXXPxMKkFxXfjzITLg0a3sBwFUQgyxMJScYRrOOgQm3hCOpWNX-aIv7QjTPYxQVssPotn9rVX5wk1K_a_QWhlH1QPyUUUjLnNA7Dwt3yjEpcwCQpb4u8wQhOp5zI4weJ3mHzY-yFYd0z-9fOBA5gpxglUbWbvymm2cr_lcT09Z56IuxMy6TDFIOB05EqIsiJPGNU12sSKO-Ly7nh1gIcLq70yw',
      })
    })
    it('imports RSA key pair with 2048 bit length with provided keyId', async () => {
      const keyId = 'test-key-id'
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kid: keyId,
          p: '8zBiIsI0_zkkHPqBKiajbKFktWs4b00sB29wx9Q1t2mY59hxka5aqrC2OdzlemEQimSKvnx6729CQd4PAU6mlMDaryS-3eiddJ7f-DoVpytpmaFvsrhsad6KwdOYf2IvjHnLIVTli5asS6Ec-aeXRi9VpJH1nM__eY5otbQfwq0',
          kty: 'RSA',
          q: '1EWuwEEdZZPi27yxOBJfvmo6eXzaGqvryEg1nm0hfdVKGI32dxEQabzvDUFNHdlvp2pDYs7_NdNfsKYFH9z0vsmvWt9q5whc73fvCMw3I9ryB3uAq9mrpH2m4JyvaDnCmPGD3cvTmpe-0_l9px23LASRnWdeKKjJy3dM1bb4fFc',
          d: 'JCjUWV7EcxEwcXMSTjGQ9F_dNEtRAPgNMX2QQs8pwZ5hGzLWYtnvt4m_xA6jxGjJtOBLrdOopOgT7eIacA1DluXGG58CJ40LzXeilctpHYq5isnBYU5ZhwH1E_QQwbUGlNnyYtFhTWRFXDStZNRNRQL6fm_jcn86HC6VRlQ9zkMlld5cqClbCRMC-neloO2CYOJxb24Vfts86iuxj699mAZBXD78tR3FCxsmYo-QhgZpGUHm5qWfdqQkXNJ5K9XCRFEMnjjW6LPbkteSZlsQzgJMl1p-Q50q9JAedBqaG-ovtW6rvMPEu1CfAtx4myH7oia45lCgt6697_xK2UflQQ',
          e: 'AQAB',
          qi: 'O8L2RkhvxNIJxCJjXM0eP3XhMFIhEUpfYOPyaYT9sqWoDBQI1V9-GXM5yewuNfdM0DdpgtrwFx55V9-dNfUK7gIvV9mY4UhLnUeIBQJHpaMv-wTz5MMsn6Z3zGVduX29iQw-xJgy6wEKBvt7lNO0fGTfHZqZD6JZGrxuVU63-0g',
          dp: 'a1fv-We__Og8CI6KdRCZElorGek5_-cQiDeokIwbKdpyo-PmPWe4nZ9i0CexI1O0-WFn3K0VlpqFpI1gEjOlVAPMg4K0vT7wQYnfUrJQ3HlNI4MeysSdFh4lIWlE5vVwB5G7F_thVzwq0TdMkuZm35QFOZ8zywQEwKMblRjs7AE',
          dq: 'Vjv4wiGxz5JElwAQ_rZ4LuL43mHaOPuezb6ICdRLxtLfRxplBfnosQwQEVJ2AapTsa95sKpnA3bbaOgJLOiWhOtqUYBx7Wl4V9BhSzGrNOW9bUy--RF0qV5ibN06ZR0R8RAsge5MCIGdBIBWi42G3Fr-zPMxTVNEp2PP0wKB8AE',
          n: 'yaZDUMEKq5pNx_ZSoXTqWIvMKJ2nZA2NihSaD6vti2riwd9FqC0EY4oBWKr0CrrGRC63SgywMo2ywTh4SsErIojo2kuVfaFFadsOaIRri1LuhN08tkdWYSSvcUybOXXPxMKkFxXfjzITLg0a3sBwFUQgyxMJScYRrOOgQm3hCOpWNX-aIv7QjTPYxQVssPotn9rVX5wk1K_a_QWhlH1QPyUUUjLnNA7Dwt3yjEpcwCQpb4u8wQhOp5zI4weJ3mHzY-yFYd0z-9fOBA5gpxglUbWbvymm2cr_lcT09Z56IuxMy6TDFIOB05EqIsiJPGNU12sSKO-Ly7nh1gIcLq70yw',
        },
      })

      expect(result).toEqual({
        keyId,
        publicJwk: {
          kid: keyId,
          kty: 'RSA',
          e: 'AQAB',
          n: 'yaZDUMEKq5pNx_ZSoXTqWIvMKJ2nZA2NihSaD6vti2riwd9FqC0EY4oBWKr0CrrGRC63SgywMo2ywTh4SsErIojo2kuVfaFFadsOaIRri1LuhN08tkdWYSSvcUybOXXPxMKkFxXfjzITLg0a3sBwFUQgyxMJScYRrOOgQm3hCOpWNX-aIv7QjTPYxQVssPotn9rVX5wk1K_a_QWhlH1QPyUUUjLnNA7Dwt3yjEpcwCQpb4u8wQhOp5zI4weJ3mHzY-yFYd0z-9fOBA5gpxglUbWbvymm2cr_lcT09Z56IuxMy6TDFIOB05EqIsiJPGNU12sSKO-Ly7nh1gIcLq70yw',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, keyId)
      expect(storedKey).toEqual({
        kid: keyId,
        kty: 'RSA',
        e: 'AQAB',
        n: 'yaZDUMEKq5pNx_ZSoXTqWIvMKJ2nZA2NihSaD6vti2riwd9FqC0EY4oBWKr0CrrGRC63SgywMo2ywTh4SsErIojo2kuVfaFFadsOaIRri1LuhN08tkdWYSSvcUybOXXPxMKkFxXfjzITLg0a3sBwFUQgyxMJScYRrOOgQm3hCOpWNX-aIv7QjTPYxQVssPotn9rVX5wk1K_a_QWhlH1QPyUUUjLnNA7Dwt3yjEpcwCQpb4u8wQhOp5zI4weJ3mHzY-yFYd0z-9fOBA5gpxglUbWbvymm2cr_lcT09Z56IuxMy6TDFIOB05EqIsiJPGNU12sSKO-Ly7nh1gIcLq70yw',
      })
    })

    it('imports RSA key pair with 3072 bit length', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'RSA',
          p: '3y_fDcS8HyfpRe6s5CQhiwT6OieLYxU1dF-hBMtxc4pH1IHjntu7LVlM_Q6pPdhXYuZXYthRq7art8N8P8mTcflZKOoT3FapIg6vLKRRBvIMbwmHbKq8qGhbIIFEcbm4OQvaUgt8NO1umDwdfU3H05Vb3UzM_v7ivM1fvnOrmyZSzTNucbpm627vg8n9RxeNENoK4zySirraj52VYAdOJE9LFvG9N7C6XZssbXNKmIlUvhgbZPhrKlpRzBCrg6s7',
          q: 'zdDYPk9uL3ASmDVBdPxz_f70MGe7RvF52f0yfhZAURApm1Go-fix4fdF4vbwHyAgP5KRpSASR5L-Lf7omiOkQfHkPNcfOSGQZ2HK8cgdCs2HUyIv7gCw4nZft9k1kvb_J2Ua5PNMYXKIcxmhxaEJ8u5OgJkznYtBpRJ1aZq0futiA_zUhd4UAiQ5gkAAczatJp32Sm0RLoBaUGFCeUQ_BcOtDX3P1OyNb38mdXgnSdTgiM2Jj5IFS-Epelv1ChMl',
          d: 'IqMwCJ_APz9wXrLuzG8UJgKHRZssgUjIfZ3VqPO_olpXmMD8qe5LhbJb6XRkSsrhXzvFF0Jm4az3zJPA01oHLfIJxAa5D9MAf3tAFnuvQxtIiYfI2__LE3obLNlGdpJnO1pkOJtz7SK5MEqbEoQ2F5Fm4ysA7DYWjQbYle5A0yLXbqSORyZjGpY_NzX0rYJ4R4E3ag0_lmFLvRt2fJEqEMs4sf_EQ8Z_8OScaWFjYfEEyzlQqfcSPjC_SloyosDE0wNvKQOaSCD0UBSvPKdGpY41BP7ksWDF48R0gtO0aHYfMq9gPv_0QIfnOFZne3ucf4gO5BLdHvfZv0d25RdqV8OdSIbjSAR7ppHO0UUfP8FX0QU08AojqCQtPn8yrcLzqk5KTkaGBB24cDCFCNj-4FYGEiREjh7Fk-iUKivVfzLiz-cLGyZUPSQ2HVeUr88ZdPqkhLjgeOzl8lh24EKr2-Y1rYv4HvqVcGVseUKKp1s14i68nqTdJMr-7hq3eK65',
          qi: 'gHvPnpn3YwgxSZ7BHdNm_vzT9Meg4L-LFKfjyOdAcwAehd_HsCXX2GDncIi4_SVtO_NTIcITt4YuJxmbgFdpyTeKvke_uuhfWERLUpE4g-Y0LobYx4_r18WqtzSO1pZDGSvsy4WV9ELUkY8gaCGLxh31l_1hhGIyCmIE4MSo9kO5vAyQw-yWt5gOBftkzzHBjEYxDBW7gxS4aRxGteRHwca0MDQIikRltIFaS7fjHHxNz_y-PkYux20ckM7VqV6t',
          dp: 'ntAHnlqBqoHR4itF50k2fR_blooRCz5KPTbW8vx5DEg3eKW8fIvKkyhaOi-2igVpmTxirjlTVCa15hs6TIF5Y76UjSKTY1RfIZblW5TI-3I9Gr3jGZYcjJFFVsnlFC-dQSqH_Z2ikl7pNXaBXWp9aLd9GOnPbRud588T9AeG8u3AObgBPPfwyFK2KEcQ7Qd7H6Sn3q55cDIp18vAQQaxufCadAcsJ3agBn-mi3Ngf04peOLai2yhhQ-j6Ntr0FOF',
          dq: 'vy83EHqccfh7bWRbD57K6LCCiMxzDO2XMUWgN7vXtvV6kMsEWmAIbU1TYAfe-irPif5OyMLH-DC1aGiYDUb6eD-IsnNqj5l8GGyhJoOrZrOQ90qUl1OQ_GzVcWSV_ZTvY9rpZrASzZqk4bZ3ratwIHf5-D9X0QrgycQhyR1qeVOR0v5zNH8cuviHa1SklmG96ldlx7EU-stEGdKe-yLIIESqZhPukW3D3ESSpyAb7tuOT8YN-I292cSo0P7G2rr5',
          e: 'AQAB',
          n: 's29pCfjF9uM8z4WQkfoQAhPlsk3zGVc7HbuMeI0s0uT8CSiFIMfgMIW_xMGmLZgdLpXKRnMvAj4741ZfnXhaAdiI6kG05Y2s9ot-xTYLRFi0mTrp4M9a8a1KTdXGU1j4xV62yakzRMDZ9Rvus3mROeI49FJmqMj0WL2uJIWcRE74e2_Hk8swughVQvuwBK1qGDEHc72UYTq_CCOGgZ80tnhFEYNatOvcIVv_OxqgDLdO-_mvKiUyeQdVwqKsYrzLtAJwhbRv1Lg_jm61NbSIRwtjvwA5fw4jC08Xh1Z6gg8s1ZpCzjcZhFw-nn3VyMRrzLxDQ56mUc606IQC4cjIOpC_VTSZWjmrgSwb4iktbzp1g4BxD5O51g_enW-6PsJE6M7IQ0uFzYLsTCDbHO5eYPhkdM_bymZmZ4sgyrrQ6mwUGiKAZ_4hmPqmag6lWMQQfhfGPVU9sR_TQ3tWNtrsOOh8f4dxQ8pvODohpZs1ii2_sjLRmkJv2QuebSC3CyCH',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'RSA',
          e: 'AQAB',
          n: 's29pCfjF9uM8z4WQkfoQAhPlsk3zGVc7HbuMeI0s0uT8CSiFIMfgMIW_xMGmLZgdLpXKRnMvAj4741ZfnXhaAdiI6kG05Y2s9ot-xTYLRFi0mTrp4M9a8a1KTdXGU1j4xV62yakzRMDZ9Rvus3mROeI49FJmqMj0WL2uJIWcRE74e2_Hk8swughVQvuwBK1qGDEHc72UYTq_CCOGgZ80tnhFEYNatOvcIVv_OxqgDLdO-_mvKiUyeQdVwqKsYrzLtAJwhbRv1Lg_jm61NbSIRwtjvwA5fw4jC08Xh1Z6gg8s1ZpCzjcZhFw-nn3VyMRrzLxDQ56mUc606IQC4cjIOpC_VTSZWjmrgSwb4iktbzp1g4BxD5O51g_enW-6PsJE6M7IQ0uFzYLsTCDbHO5eYPhkdM_bymZmZ4sgyrrQ6mwUGiKAZ_4hmPqmag6lWMQQfhfGPVU9sR_TQ3tWNtrsOOh8f4dxQ8pvODohpZs1ii2_sjLRmkJv2QuebSC3CyCH',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'RSA',
        e: 'AQAB',
        n: 's29pCfjF9uM8z4WQkfoQAhPlsk3zGVc7HbuMeI0s0uT8CSiFIMfgMIW_xMGmLZgdLpXKRnMvAj4741ZfnXhaAdiI6kG05Y2s9ot-xTYLRFi0mTrp4M9a8a1KTdXGU1j4xV62yakzRMDZ9Rvus3mROeI49FJmqMj0WL2uJIWcRE74e2_Hk8swughVQvuwBK1qGDEHc72UYTq_CCOGgZ80tnhFEYNatOvcIVv_OxqgDLdO-_mvKiUyeQdVwqKsYrzLtAJwhbRv1Lg_jm61NbSIRwtjvwA5fw4jC08Xh1Z6gg8s1ZpCzjcZhFw-nn3VyMRrzLxDQ56mUc606IQC4cjIOpC_VTSZWjmrgSwb4iktbzp1g4BxD5O51g_enW-6PsJE6M7IQ0uFzYLsTCDbHO5eYPhkdM_bymZmZ4sgyrrQ6mwUGiKAZ_4hmPqmag6lWMQQfhfGPVU9sR_TQ3tWNtrsOOh8f4dxQ8pvODohpZs1ii2_sjLRmkJv2QuebSC3CyCH',
      })
    })

    it('imports RSA key pair with 4096 bit length', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'RSA',
          p: '1kePVZiE7aa8RAGR6D9oy3MXbPFKN9IfZ8OmZ5j2P9i7ScX5nqPfrYlXkc-MJ7pmaVNlOlmwiuJvPElDiIFkW8Obcd-BqK6gRQ0oMFv9y6svB48_E9RKSNzOPNtoVQG0W_ip3yd5LsMaBKbGeRGjhjCY-UeUJ8hRokw6s3b9V09gOWwACMpH23hrrNc50TQMMtWmTHv8XvNVj1tY8501PwbYqyBcD_chUEAZzpkGVfVEXKqGqIszadvTq8CvRJgxJojYrGKcOU007AdYis3x_2-Ey-jZDAlDGS_lu0Q4NWznhLaW6LMfbTPzdYJ6E0LrcvoI0MuZ_3qvEFhWF4CJtw',
          q: '0gGvWRRl19KMWgjiF03jOFOPTEdOxjVXU5fCrAbohalkIcycti5bAD3A1wIk3sHBy1D3bWyBLbF5NrafRlKLlrf3segUvYMlly2Ux96J-G5F2FqxYKPa3F777cK_UPqcrefkbRCwpPsqW-CLBTRqxTXBMo8SAS4n-9umjZRb-Z44uToy5DmZWLmXsg95DkHZgEktYdo8ImeAspMsouFdCgw400SKCQ7kdW6K_RakP7M-Si2cAeQXBd9Z_O3ku_WdZE_XUuTDBR-cDIZq8bXH1ysaMcmCN6tIF3nRHfJI2Kr4wNSw_nLD75dLxkRRpyjKA8mWu4WGSqcxAY_3q11sLQ',
          d: 'UZz7jfMpU3-vE5FOlzk5ZsI_V5ZBL4_gNKxWh_hiAn5x9H83Odbgc2V5n61YLoI1bad_v5CgLGsRe3WaujRACCr0Vee0KbahH829gFrd8eVTffJHmcxgRZ1qRDe3ptTWgGnN5HXTsR0r_uXcws_vbw3PIKIsK3USH7HFyivS3I2IZamiCM8Gsqxd5JLJ6eDpETwT8yNPBm6KyIo6yNTT02wpnFirTHdMzWQwG5w0ZQOneBSzDpTX5SAj_yk_i_KVjg3QGaXf9hmhl0eJu7Bhx6q9COPjmPUdct47j9N396GE4TEORjh-1m7AvGYw08G1m75TB8K5mL_9W6lqoksU5dZeaQDtQl4AV58uZwWXShevipTyJBYgyk-GQCxIXHd_gCXMPVDZvCL1rBMmqSh5XSj84XEVVZKNb3PHuHxwWMopWxSyoD6SJyPYaDpyRtrQPIi79iDneNbfJuuHAoFE2wNOiX43Vvafe9qo3kk8BUw5N7RrSXw99-R75SIzrwgY1Hh90mSVoXrf1QhJhhQwXLSL6tgmxXbmGG4jY-rBPE04XQfsEEFoNrZZsx1Kx3GFm8JwflpbRLtqvlXbyCZ9aqIoPbABizoYEGo2mwububbAZy-UKJSEEayfj_9L6K4MyCZBUNJ3zretbMNi5amm_aUrE5CYU4mgh93GWxatQeE',
          qi: 'XN0HMYoftF55U-ANATf6MYh7dktdq3KV0hClJrGk0CPLW8G3PDIq-NN9w6TSMVPmcxSGbRH9tGV05oeW_L_iHMDEhKG290BMrXaPmLeomq7xgO9dA15Mv9wTZYCGaBE-vi3rYbpwUPCrvrXz0IffvRovqsudxVUGpcUEzkWYc1RfU_jD5YSn2flEshE4n8hwvd06AePD0SDyVi_rRhixzAsocuPmtkRfdUgP41iDLFPJAuIXRyu4964BdQveemhkv3V8vIby0c2T_eb8E34d02kAYVR1Kib-C2_kPXhYi4QluToevLySfGGoUrpsdYNv-kK1f2IhRVZzCbtwcOKNmg',
          dp: 'OoJpsf6mdVns2EjxdVAzJjJz-AxerqVSa_vxaSJMQxzD7x3-zgGDJxh0b90TMRnlsubRokAxQ4sWwohix1hFdgUQYeScu9mK66_vBF1qDH3epprHp3t1GTYpnlZuw59mhyJ8B_H4VftyFEkRsqdNVmvYqWCRJNe-6qkT8kMQZBHJfYRu8feB7XyRMi3GnMgweIT8FrBYNfkNqMpRnJuVmXMeIIQCf12EnCwUn-QK5dfF5eOuR0FTNZmPz7saYImKCjKdr1xxuffJ9pT-6U_Yv13NDfyzn2S8DJmWii7ThksJYKSWyk12zFO-K50IBlBkiA2b8J9Xmnn-aWEliN9ROw',
          dq: 'PdQvKvvdbChaGBvrbM8Kqce4Nc38vFByEHNq5jj2dnvDtkvGi8CkHDMSNns0Hb1P8Cs7XaUHd0t8E4a65_pfjJVHQMLCcHVPOO47kojLeDAHMkapWHmFc0Iny_19VDskq_LNButWBozIENrQM00Wbk-APQFwXJaZQQaPR7m5Rom1y5r95sGqizvBFLSHgJIUljd1PA0DjWGJu4mnJ6FQQigNBu5z8WzICGbuVss2umZsXWyGNOxRdvImTVhA8rHCkAkNrSMa48RFrk5Y6CcL2iafhK7-PqOYCwlbbwSpO9lCeYtlPNTPKRgTQCFXJO7WYz0Tusv6GLqWrA4V7gcIVQ',
          e: 'AQAB',
          n: 'r8gcoUFh0ZErAKSD25XuKeUyMT-ClvotEPc-VA58z3E2k5zjkmi_gYOGfOl8HKAWeqx8CbH9WaVSEVt84q3wSZdPID132dxZ-bsfcyF4fCP8qYaxdDzuAyTZadsmDLD-U-8GR08NfGxWys9VpzHtNodWgmIsVcJCeLaUx8dwCONEpVJYzDd00xlHQHOepZj6iFa7-vIekl76xqnXkxhNmz3_d0ClFBzil8jJpfrzuhGsCHLIqwZY_uPGPsYSaxo6fqG4yQb60TOns53gMPMW6xJyp0OlpfMyyFW8NMKUxfXxJejozo2WhZU-uPLz71RQEr6IwCQWcTkGuks797O8K1j3sqVOJMiGfUfWnK9XlW_8HJTH3jgfOgYsQn9rlFRVDt-t8JkyUUQWk3x2QiF2Yegy-JZU317iM8Z8eO-uMFAw-d3c1KJRuWRJG9QSj68GXqNXmwRIcIPD7poPUGee7mcCNz5Co7OxOwF_fC7ntqnis0PbvykPJN2w9ophrgT4vc8qE5TPboSam0hGKL2o2xKqyRSwl9vg1qEz1MIeYfJJ109J8a_T2Ltr41k2waxZb6NYsoYJHKgyZI1oMUhiESwRy7IjoDmj7X6NeKkHBKuUT4CAUMU1Ub_3_zF8CA34kDx4U4uMm5NqD2tKwka5-vWKuMkGwO7MTsZXTKAsaSs',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'RSA',
          e: 'AQAB',
          n: 'r8gcoUFh0ZErAKSD25XuKeUyMT-ClvotEPc-VA58z3E2k5zjkmi_gYOGfOl8HKAWeqx8CbH9WaVSEVt84q3wSZdPID132dxZ-bsfcyF4fCP8qYaxdDzuAyTZadsmDLD-U-8GR08NfGxWys9VpzHtNodWgmIsVcJCeLaUx8dwCONEpVJYzDd00xlHQHOepZj6iFa7-vIekl76xqnXkxhNmz3_d0ClFBzil8jJpfrzuhGsCHLIqwZY_uPGPsYSaxo6fqG4yQb60TOns53gMPMW6xJyp0OlpfMyyFW8NMKUxfXxJejozo2WhZU-uPLz71RQEr6IwCQWcTkGuks797O8K1j3sqVOJMiGfUfWnK9XlW_8HJTH3jgfOgYsQn9rlFRVDt-t8JkyUUQWk3x2QiF2Yegy-JZU317iM8Z8eO-uMFAw-d3c1KJRuWRJG9QSj68GXqNXmwRIcIPD7poPUGee7mcCNz5Co7OxOwF_fC7ntqnis0PbvykPJN2w9ophrgT4vc8qE5TPboSam0hGKL2o2xKqyRSwl9vg1qEz1MIeYfJJ109J8a_T2Ltr41k2waxZb6NYsoYJHKgyZI1oMUhiESwRy7IjoDmj7X6NeKkHBKuUT4CAUMU1Ub_3_zF8CA34kDx4U4uMm5NqD2tKwka5-vWKuMkGwO7MTsZXTKAsaSs',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'RSA',
        e: 'AQAB',
        n: 'r8gcoUFh0ZErAKSD25XuKeUyMT-ClvotEPc-VA58z3E2k5zjkmi_gYOGfOl8HKAWeqx8CbH9WaVSEVt84q3wSZdPID132dxZ-bsfcyF4fCP8qYaxdDzuAyTZadsmDLD-U-8GR08NfGxWys9VpzHtNodWgmIsVcJCeLaUx8dwCONEpVJYzDd00xlHQHOepZj6iFa7-vIekl76xqnXkxhNmz3_d0ClFBzil8jJpfrzuhGsCHLIqwZY_uPGPsYSaxo6fqG4yQb60TOns53gMPMW6xJyp0OlpfMyyFW8NMKUxfXxJejozo2WhZU-uPLz71RQEr6IwCQWcTkGuks797O8K1j3sqVOJMiGfUfWnK9XlW_8HJTH3jgfOgYsQn9rlFRVDt-t8JkyUUQWk3x2QiF2Yegy-JZU317iM8Z8eO-uMFAw-d3c1KJRuWRJG9QSj68GXqNXmwRIcIPD7poPUGee7mcCNz5Co7OxOwF_fC7ntqnis0PbvykPJN2w9ophrgT4vc8qE5TPboSam0hGKL2o2xKqyRSwl9vg1qEz1MIeYfJJ109J8a_T2Ltr41k2waxZb6NYsoYJHKgyZI1oMUhiESwRy7IjoDmj7X6NeKkHBKuUT4CAUMU1Ub_3_zF8CA34kDx4U4uMm5NqD2tKwka5-vWKuMkGwO7MTsZXTKAsaSs',
      })
    })

    it('imports EC P-256 key pair with provided keyId', async () => {
      const keyId = 'test-key-id'

      const result = await service.importKey(agentContext, {
        privateJwk: {
          kid: keyId,
          kty: 'EC',
          d: '58pb2cKWs0VmIXtHz3ayrZCGKRUnWrb9QvbfbAkGI3c',
          crv: 'P-256',
          x: 'wPuEY7sKE2x2rp96_QtnRhSswV2AgBk_cX5TCmvLxPs',
          y: 'OG0Lm7begM02Vikg2iI70nknoWNygwlUoBGLLFDT3Zs',
        },
      })

      expect(result).toEqual({
        keyId,
        publicJwk: {
          kid: keyId,
          kty: 'EC',
          crv: 'P-256',
          x: 'wPuEY7sKE2x2rp96_QtnRhSswV2AgBk_cX5TCmvLxPs',
          y: 'OG0Lm7begM02Vikg2iI70nknoWNygwlUoBGLLFDT3Zs',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, keyId)
      expect(storedKey).toEqual({
        kid: keyId,
        kty: 'EC',
        crv: 'P-256',
        x: 'wPuEY7sKE2x2rp96_QtnRhSswV2AgBk_cX5TCmvLxPs',
        y: 'OG0Lm7begM02Vikg2iI70nknoWNygwlUoBGLLFDT3Zs',
      })
    })

    it('imports EC P-384 key pair', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'EC',
          d: 'O2WHQQDOvifmepR3kxDRJh1TBd-LaEww5lYzrd14lzfi4IVIVm__ZQVoUQ0ws56e',
          crv: 'P-384',
          x: 'Vvlf4tmvKT1qTOptwSelZBoazQmrsKvg1poITeOoxqbZEgNvfa9cUObhQlbhHjGP',
          y: 'gTMFQKmXdcK31ycnDULFEtCLF3vsXNnAcQcFbeapxqBpo_wMdSP-G8pN9jPMDPYS',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'EC',
          crv: 'P-384',
          x: 'Vvlf4tmvKT1qTOptwSelZBoazQmrsKvg1poITeOoxqbZEgNvfa9cUObhQlbhHjGP',
          y: 'gTMFQKmXdcK31ycnDULFEtCLF3vsXNnAcQcFbeapxqBpo_wMdSP-G8pN9jPMDPYS',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'EC',
        crv: 'P-384',
        x: 'Vvlf4tmvKT1qTOptwSelZBoazQmrsKvg1poITeOoxqbZEgNvfa9cUObhQlbhHjGP',
        y: 'gTMFQKmXdcK31ycnDULFEtCLF3vsXNnAcQcFbeapxqBpo_wMdSP-G8pN9jPMDPYS',
      })
    })

    it('imports EC P-521 key pair', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'EC',
          d: 'Af8IOTaFSKF65L6vI-UTAhUpO0LbtiK-2W-Qs5-jvpLAnmalTUNX3r7mZhH1zioq26NayCFTgEZVWAwMgeEqindK',
          crv: 'P-521',
          x: 'AfenCyIa_2pnNYybfgdhy19fVnrBksaHgQUy4bCu3kiA8_cZujnsO6RgpIWx2ip3cdXsi2ujK-mShjIveNwdwiBF',
          y: 'AVKOcCI-Zg_0IlhpCJ77wwMFjXuVpt-nilcSQY9E0JADcXQGaWSAWKWpAbCAeeevoBHepELbIJ5bX3EnU3yKMMQL',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'EC',
          crv: 'P-521',
          x: 'AfenCyIa_2pnNYybfgdhy19fVnrBksaHgQUy4bCu3kiA8_cZujnsO6RgpIWx2ip3cdXsi2ujK-mShjIveNwdwiBF',
          y: 'AVKOcCI-Zg_0IlhpCJ77wwMFjXuVpt-nilcSQY9E0JADcXQGaWSAWKWpAbCAeeevoBHepELbIJ5bX3EnU3yKMMQL',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'EC',
        crv: 'P-521',
        x: 'AfenCyIa_2pnNYybfgdhy19fVnrBksaHgQUy4bCu3kiA8_cZujnsO6RgpIWx2ip3cdXsi2ujK-mShjIveNwdwiBF',
        y: 'AVKOcCI-Zg_0IlhpCJ77wwMFjXuVpt-nilcSQY9E0JADcXQGaWSAWKWpAbCAeeevoBHepELbIJ5bX3EnU3yKMMQL',
      })
    })

    it('imports EC secp256k1 key pair', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'EC',
          d: 'eGYeYMILykL1YnAZde1aSo9uQtKe-HeALQu2Yv-ZcQ0',
          crv: 'secp256k1',
          x: 'ZLRfyFqy_hVG_SWH7SlErOCMkztJNoZZHdJvMt6yPSE',
          y: 'O89repvsgjOY9qAOZcmdIiITHU4Frk00ryKGDw7OefQ',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'EC',
          crv: 'secp256k1',
          x: 'ZLRfyFqy_hVG_SWH7SlErOCMkztJNoZZHdJvMt6yPSE',
          y: 'O89repvsgjOY9qAOZcmdIiITHU4Frk00ryKGDw7OefQ',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'EC',
        crv: 'secp256k1',
        x: 'ZLRfyFqy_hVG_SWH7SlErOCMkztJNoZZHdJvMt6yPSE',
        y: 'O89repvsgjOY9qAOZcmdIiITHU4Frk00ryKGDw7OefQ',
      })
    })

    it('imports OKP Ed25519 key pair', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'OKP',
          d: 'IbJKmlKmRDoSkO0xM_DkeorvBz--1O_qGlmrb6_1Cms',
          crv: 'Ed25519',
          x: '4-CJ6REW9mUtp2ouh5rhQ9wvfsZE278NnPffTkLeNYI',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'OKP',
          crv: 'Ed25519',
          x: '4-CJ6REW9mUtp2ouh5rhQ9wvfsZE278NnPffTkLeNYI',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'OKP',
        crv: 'Ed25519',
        x: '4-CJ6REW9mUtp2ouh5rhQ9wvfsZE278NnPffTkLeNYI',
      })
    })

    it('imports OKP X25519 key pair', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'OKP',
          d: '7LL0_o4FsS4w-mCFhcKlbaX8qsqgeNjTxzDV4lVj0us',
          crv: 'X25519',
          x: 'DdYl5R2IpY7VwLr88mgG9PBjK7jICuipVYhOzz8F3Fs',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'OKP',
          crv: 'X25519',
          x: 'DdYl5R2IpY7VwLr88mgG9PBjK7jICuipVYhOzz8F3Fs',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'OKP',
        crv: 'X25519',
        x: 'DdYl5R2IpY7VwLr88mgG9PBjK7jICuipVYhOzz8F3Fs',
      })
    })

    // NOTE: we need to tweak the API here a bit I think. Just the JWK is not enough
    // we need something of an alg.
    it('imports oct key', async () => {
      const result = await service.importKey(agentContext, {
        privateJwk: {
          kty: 'oct',
          k: '7LL0_o4FsS4w-mCFhcKlbaX8qsqgeNjTxzDV4lVj0us',
        },
      })

      expect(result).toEqual({
        keyId: result.keyId,
        publicJwk: {
          kid: result.keyId,
          kty: 'oct',
        },
      })

      // Verify key was stored
      const storedKey = await service.getPublicKey(agentContext, result.keyId)
      expect(storedKey).toEqual({
        kid: result.keyId,
        kty: 'oct',
      })
    })

    it('error when importing invalid oct key', async () => {
      const error = await service
        .importKey(agentContext, {
          privateJwk: {
            kty: 'oct',
            k: '#@$%',
          },
        })
        .then(() => undefined)
        .catch((e) => e)
      expect(error).toBeInstanceOf(Kms.KeyManagementError)
      expect(error.cause).toBeInstanceOf(ZodValidationError)
      expect(error.cause.message).toContain('Must be a base64url string')
    })

    it('generates random keyId when not provided', async () => {
      const privateJwk: Kms.KmsJwkPrivate = {
        kty: 'EC',
        d: 'ESGpJ7SIi3H7h9pkIkr-M8QDWamtiewze5_U_nP2fJg',
        crv: 'P-256',
        x: 'HlwSCoy8jWXx_KifMEnt4zDjPb0eyi0eH9C9awOdR70',
        y: 's-Drm_bZ4eVV_UkGnLr62sI2TWibkdLFFc0dAT6ASL8',
      }

      const result = await service.importKey(agentContext, { privateJwk })
      expect(result).toEqual({
        keyId: expect.any(String),
        publicJwk: {
          kid: expect.any(String),
          kty: 'EC',
          crv: 'P-256',
          x: 'HlwSCoy8jWXx_KifMEnt4zDjPb0eyi0eH9C9awOdR70',
          y: 's-Drm_bZ4eVV_UkGnLr62sI2TWibkdLFFc0dAT6ASL8',
        },
      })
    })

    it('throws error if invalid key data provided', async () => {
      const error = await service
        .importKey(agentContext, {
          privateJwk: {
            kty: 'EC',
            crv: 'P-256',
            x: 'test-x',
            y: 'test-y',
            d: 'test-d',
          },
        })
        .then(() => undefined)
        .catch((e) => e)
      expect(error).toBeInstanceOf(Kms.KeyManagementError)
      expect(error.cause.message).toEqual('Invalid JWK EC key')
    })

    it('throws error if key with same id already exists', async () => {
      const keyId = 'existing-key'
      const privateJwk: Kms.KmsJwkPrivate = {
        kid: keyId,
        kty: 'EC',
        d: '_jBF0d-pZB_Os3CrJsPthA-CDXSy17vCdyRzuAIFbaM',
        crv: 'P-256',
        x: 'IcwG4MdHi8u59kc5h-cQC31ZVC50g7qlJvWkzh_j9zw',
        y: 'iY57CM0fuBNx5ef2iviA2OiUtfExERAFLyYD1yno6Xo',
      }

      // First import succeeds
      await service.importKey(agentContext, { privateJwk })

      // Second import with same keyId fails
      await expect(service.importKey(agentContext, { privateJwk })).rejects.toThrow(
        new Kms.KeyManagementKeyExistsError('existing-key', service.backend)
      )
    })

    it('throws error when key is provided with unknown kty', async () => {
      await expect(
        service.importKey(agentContext, {
          privateJwk: {
            // @ts-expect-error
            kty: 'something',
          },
        })
      ).rejects.toThrow(new Kms.KeyManagementAlgorithmNotSupportedError(`kty 'something'`, service.backend))
    })
  })

  describe('deleteKey', () => {
    it('deletes existing key', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      // Verify key exists
      expect(await service.getPublicKey(agentContext, keyId)).toBeTruthy()

      // Delete key
      expect(await service.deleteKey(agentContext, { keyId })).toBe(true)

      // Verify key no longer exists
      expect(await service.getPublicKey(agentContext, keyId)).toBeNull()
    })

    it('succeeds when deleting non-existent key', async () => {
      expect(await service.deleteKey(agentContext, { keyId: 'nonexistent' })).toBe(false)
    })

    it('removes key from storage completely', async () => {
      const { keyId } = await service.createKey(agentContext, {
        type: { kty: 'RSA', modulusLength: 2048 },
      })

      await service.deleteKey(agentContext, { keyId })

      // Verify we can't use the deleted key
      await expect(
        service.sign(agentContext, {
          keyId,
          algorithm: 'RS256',
          data: new Uint8Array([1, 2, 3]),
        })
      ).rejects.toThrow(new Kms.KeyManagementKeyNotFoundError(keyId, service.backend))
    })
  })
})
