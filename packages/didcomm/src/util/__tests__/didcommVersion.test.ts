import { CredoError, JsonEncoder } from '@credo-ts/core'
import {
  assertDidCommV1Connection,
  isDidCommV1EncryptedMessage,
  isDidCommV2AuthcryptMessage,
  isDidCommV2EncryptedMessage,
} from '../didcommVersion'
import { DidCommConnectionRecord } from '../../modules/connections/repository'

describe('didcommVersion', () => {
  const v1Protected = JsonEncoder.toBase64Url({
    enc: 'xchacha20poly1305_ietf',
    typ: 'JWM/1.0',
    alg: 'Authcrypt',
    recipients: [],
  })

  const v2AuthcryptProtected = JsonEncoder.toBase64Url({
    typ: 'application/didcomm-encrypted+json',
    alg: 'ECDH-1PU+A256KW',
    enc: 'A256GCM',
    skid: 'key-id',
    recipients: [],
  })

  const v2AnoncryptProtected = JsonEncoder.toBase64Url({
    typ: 'application/didcomm-encrypted+json',
    alg: 'ECDH-ES+A256KW',
    enc: 'A256GCM',
    recipients: [],
  })

  describe('isDidCommV2EncryptedMessage', () => {
    it('returns false for non-JWE input', () => {
      expect(isDidCommV2EncryptedMessage('invalid')).toBe(false)
      expect(isDidCommV2EncryptedMessage(null)).toBe(false)
      expect(isDidCommV2EncryptedMessage({})).toBe(false)
    })

    it('returns true for v2 encrypted message', () => {
      const message = {
        protected: v2AuthcryptProtected,
        iv: 'base64iv',
        ciphertext: 'base64ciphertext',
        tag: 'base64tag',
      }
      expect(isDidCommV2EncryptedMessage(message)).toBe(true)
    })

    it('returns true for v2 anoncrypt message', () => {
      const message = {
        protected: v2AnoncryptProtected,
        iv: 'base64iv',
        ciphertext: 'base64ciphertext',
        tag: 'base64tag',
      }
      expect(isDidCommV2EncryptedMessage(message)).toBe(true)
    })

    it('returns false for v1 encrypted message', () => {
      const message = {
        protected: v1Protected,
        iv: 'base64iv',
        ciphertext: 'base64ciphertext',
        tag: 'base64tag',
      }
      expect(isDidCommV2EncryptedMessage(message)).toBe(false)
    })
  })

  describe('isDidCommV1EncryptedMessage', () => {
    it('returns false for non-JWE input', () => {
      expect(isDidCommV1EncryptedMessage('invalid')).toBe(false)
    })

    it('returns true for v1 encrypted message', () => {
      const message = {
        protected: v1Protected,
        iv: 'base64iv',
        ciphertext: 'base64ciphertext',
        tag: 'base64tag',
      }
      expect(isDidCommV1EncryptedMessage(message)).toBe(true)
    })

    it('returns false for v2 encrypted message', () => {
      const message = {
        protected: v2AuthcryptProtected,
        iv: 'base64iv',
        ciphertext: 'base64ciphertext',
        tag: 'base64tag',
      }
      expect(isDidCommV1EncryptedMessage(message)).toBe(false)
    })
  })

  describe('isDidCommV2AuthcryptMessage', () => {
    it('returns true for v2 authcrypt message', () => {
      const message = {
        protected: v2AuthcryptProtected,
        iv: 'base64iv',
        ciphertext: 'base64ciphertext',
        tag: 'base64tag',
      }
      expect(isDidCommV2AuthcryptMessage(message)).toBe(true)
    })

    it('returns false for v2 anoncrypt message', () => {
      const message = {
        protected: v2AnoncryptProtected,
        iv: 'base64iv',
        ciphertext: 'base64ciphertext',
        tag: 'base64tag',
      }
      expect(isDidCommV2AuthcryptMessage(message)).toBe(false)
    })

    it('returns false for non-JWE input', () => {
      expect(isDidCommV2AuthcryptMessage('invalid')).toBe(false)
    })
  })

  describe('assertDidCommV1Connection', () => {
    it('does not throw for v1 connection', () => {
      const connection = { didcommVersion: 'v1' } as DidCommConnectionRecord
      expect(() => assertDidCommV1Connection(connection, 'Message Pickup')).not.toThrow()
    })

    it('does not throw when didcommVersion is undefined (defaults to v1)', () => {
      const connection = {} as DidCommConnectionRecord
      expect(() => assertDidCommV1Connection(connection, 'Mediation')).not.toThrow()
    })

    it('throws for v2 connection', () => {
      const connection = { didcommVersion: 'v2' } as DidCommConnectionRecord
      expect(() => assertDidCommV1Connection(connection, 'Message Pickup')).toThrow(CredoError)
      expect(() => assertDidCommV1Connection(connection, 'Message Pickup')).toThrow(
        'Message Pickup is restricted for DIDComm v2 connections'
      )
    })
  })
})
