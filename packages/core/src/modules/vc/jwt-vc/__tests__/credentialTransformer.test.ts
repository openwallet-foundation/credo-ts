import { JwtPayload } from '../../../../crypto/jose/jwt'
import { JsonTransformer } from '../../../../utils'
import { W3cCredential } from '../../models'
import { getCredentialFromJwtPayload, getJwtPayloadFromCredential } from '../credentialTransformer'

describe('credentialTransformer', () => {
  describe('getJwtPayloadFromCredential', () => {
    test('extracts jwt payload from credential', () => {
      const credential = new W3cCredential({
        type: ['VerifiableCredential'],
        credentialSubject: {
          id: 'https://example.com',
        },
        issuanceDate: new Date('2020-01-01').toISOString(),
        issuer: 'did:example:123',
        id: 'urn:123',
      })

      const jwtPayload = getJwtPayloadFromCredential(credential)

      expect(jwtPayload.toJson()).toEqual({
        vc: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential'],
          credentialSubject: {},
          expirationDate: undefined,
        },
        nbf: expect.any(Number),
        iss: 'did:example:123',
        jti: 'urn:123',
        sub: 'https://example.com',
        aud: undefined,
        exp: undefined,
        iat: undefined,
      })
    })
  })

  describe('getCredentialFromJwtPayload', () => {
    test('extracts credential from jwt payload', () => {
      const vc: Record<string, unknown> = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        credentialSubject: {},
      }

      const jwtPayload = new JwtPayload({
        iss: 'urn:iss',
        nbf: 1262373804,
        exp: 1262373804,
        sub: 'did:example:123',
        jti: 'urn:jti',
        additionalClaims: {
          vc,
        },
      })

      const credential = JsonTransformer.toJSON(getCredentialFromJwtPayload(jwtPayload))

      expect(credential).toEqual({
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential'],
        id: 'urn:jti',
        issuer: 'urn:iss',
        credentialSubject: {
          id: 'did:example:123',
        },
        issuanceDate: '2010-01-01T19:23:24Z', // 1262373804
        expirationDate: '2010-01-01T19:23:24Z', // 1262373804
      })
    })

    test(`throw error if jwt payload does not contain 'vc' property or it is not an object`, () => {
      const jwtPayload = new JwtPayload({})

      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow("JWT does not contain a valid 'vc' claim")

      jwtPayload.additionalClaims.vc = 'invalid'
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow("JWT does not contain a valid 'vc' claim")
    })

    test(`throw error if jwt payload does not contain 'nbf' or 'iss' property`, () => {
      const jwtPayload = new JwtPayload({
        additionalClaims: {
          vc: {},
        },
      })

      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow("JWT does not contain valid 'nbf' and 'iss' claims")

      jwtPayload.nbf = 100
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow("JWT does not contain valid 'nbf' and 'iss' claims")

      jwtPayload.nbf = undefined
      jwtPayload.iss = 'iss'
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow("JWT does not contain valid 'nbf' and 'iss' claims")
    })

    test('throw error if jwt vc credentialSubject does not have a single credentialSubject', () => {
      const vc: Record<string, unknown> = {}
      const jwtPayload = new JwtPayload({
        iss: 'iss',
        nbf: 100,
        additionalClaims: {
          vc,
        },
      })

      // no credentialSubject at all
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT VC does not have a valid credential subject')

      // Array but no entry
      vc.credentialSubject = []
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT VCs must have exactly one credential subject')

      // Array with entry, but not an object
      vc.credentialSubject = [10]
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow(
        'JWT VCs must have a credential subject of type object'
      )

      // entry, but not an object
      vc.credentialSubject = 10
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT VC does not have a valid credential subject')

      jwtPayload.nbf = undefined
      jwtPayload.iss = 'iss'
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow("JWT does not contain valid 'nbf' and 'iss' claims")
    })

    test('throw error if jwt vc has an id and it does not match the jti', () => {
      const vc: Record<string, unknown> = {
        credentialSubject: {},
        id: '13',
      }
      const jwtPayload = new JwtPayload({
        iss: 'iss',
        nbf: 100,
        jti: '12',
        additionalClaims: {
          vc,
        },
      })

      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT jti and vc.id do not match')
    })

    test('throw error if jwt vc has an issuer id and it does not match the iss', () => {
      const vc: Record<string, unknown> = {
        credentialSubject: {},
        issuer: '123',
      }
      const jwtPayload = new JwtPayload({
        iss: 'iss',
        nbf: 100,
        additionalClaims: {
          vc,
        },
      })

      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT iss and vc.issuer(.id) do not match')

      // nested issuer object
      vc.issuer = { id: '123' }
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT iss and vc.issuer(.id) do not match')
    })

    test('throw error if jwt vc has an issuanceDate and it does not match the nbf', () => {
      const vc: Record<string, unknown> = {
        credentialSubject: {},
        issuanceDate: '2010-01-01T19:23:24Z', // 1262373804
      }
      const jwtPayload = new JwtPayload({
        iss: 'iss',
        nbf: 1577833200,
        additionalClaims: {
          vc,
        },
      })

      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT nbf and vc.issuanceDate do not match')

      vc.issuanceDate = 10
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT vc.issuanceDate must be a string')
    })

    test('throw error if jwt vc has an expirationDate and it does not match the exp', () => {
      const vc: Record<string, unknown> = {
        credentialSubject: {},
        expirationDate: '2010-01-01T19:23:24Z', // 1262373804
      }
      const jwtPayload = new JwtPayload({
        iss: 'iss',
        nbf: 1577833200,
        exp: 1577833200,
        additionalClaims: {
          vc,
        },
      })

      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT exp and vc.expirationDate do not match')

      vc.expirationDate = 10
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT vc.expirationDate must be a string')
    })

    test('throw error if jwt vc has a credentialSubject.id and it does not match the sub', () => {
      const vc: Record<string, unknown> = {}
      const jwtPayload = new JwtPayload({
        iss: 'iss',
        nbf: 1577833200,
        exp: 1577833200,
        sub: 'did:example:123',
        additionalClaims: {
          vc,
        },
      })

      vc.credentialSubject = { id: 'did:example:456' }
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT sub and vc.credentialSubject.id do not match')

      vc.credentialSubject = [{ id: 'did:example:456' }]
      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow('JWT sub and vc.credentialSubject.id do not match')
    })

    test('throw validation error if vc is not a valid w3c vc', () => {
      const vc: Record<string, unknown> = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential2'],
        credentialSubject: {},
      }

      const jwtPayload = new JwtPayload({
        iss: 'urn:iss',
        nbf: 1577833200,
        exp: 1577833200,
        sub: 'did:example:123',
        jti: 'urn:jti',
        additionalClaims: {
          vc,
        },
      })

      expect(() => getCredentialFromJwtPayload(jwtPayload)).toThrow(
        'property type has failed the following constraints: type must be an array of strings which includes "VerifiableCredential"'
      )
    })
  })
})
