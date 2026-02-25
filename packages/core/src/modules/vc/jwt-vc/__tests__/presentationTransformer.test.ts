import { JwtPayload } from '../../../../crypto/jose/jwt'
import { JsonTransformer } from '../../../../utils'
import { W3cPresentation } from '../../models'
import { getJwtPayloadFromPresentation, getPresentationFromJwtPayload } from '../presentationTransformer'
import { W3cJwtVerifiableCredential } from '../W3cJwtVerifiableCredential'

import { CredoEs256DidJwkJwtVc } from './fixtures/credo-jwt-vc'

describe('presentationTransformer', () => {
  describe('getJwtPayloadFromPresentation', () => {
    test('extracts jwt payload from presentation', () => {
      const presentation = new W3cPresentation({
        id: 'urn:123',
        holder: 'did:example:123',
        verifiableCredential: [W3cJwtVerifiableCredential.fromSerializedJwt(CredoEs256DidJwkJwtVc)],
      })

      const jwtPayload = getJwtPayloadFromPresentation(presentation)

      expect(jwtPayload.toJson()).toEqual({
        vp: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiablePresentation'],
          verifiableCredential: [CredoEs256DidJwkJwtVc],
        },
        iss: 'did:example:123',
        jti: 'urn:123',
        sub: undefined,
        aud: undefined,
        exp: undefined,
        iat: undefined,
      })
    })
  })

  describe('getPresentationFromJwtPayload', () => {
    test('extracts presentation from jwt payload', () => {
      const vp: Record<string, unknown> = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        verifiableCredential: [CredoEs256DidJwkJwtVc],
        id: 'urn:123',
        holder: 'did:example:123',
      }

      const jwtPayload = new JwtPayload({
        iss: 'did:example:123',
        nbf: undefined,
        exp: undefined,
        sub: undefined,
        jti: 'urn:123',
        additionalClaims: {
          vp,
        },
      })

      const presentation = JsonTransformer.toJSON(getPresentationFromJwtPayload(jwtPayload))

      expect(presentation).toEqual({
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation'],
        id: 'urn:123',
        holder: 'did:example:123',
        verifiableCredential: [CredoEs256DidJwkJwtVc],
      })
    })

    test(`throw error if jwt payload does not contain 'vp' property or it is not an object`, () => {
      const jwtPayload = new JwtPayload({})

      expect(() => getPresentationFromJwtPayload(jwtPayload)).toThrow("JWT does not contain a valid 'vp' claim")

      jwtPayload.additionalClaims.vp = 'invalid'
      expect(() => getPresentationFromJwtPayload(jwtPayload)).toThrow("JWT does not contain a valid 'vp' claim")
    })

    test('throw error if jwt vp has an id and it does not match the jti', () => {
      const vp: Record<string, unknown> = {
        id: '13',
      }
      const jwtPayload = new JwtPayload({
        jti: '12',
        additionalClaims: {
          vp,
        },
      })

      expect(() => getPresentationFromJwtPayload(jwtPayload)).toThrow('JWT jti and vp.id do not match')
    })

    test('throw error if jwt vp has an holder id and it does not match the iss', () => {
      const vp: Record<string, unknown> = {
        holder: '123',
      }
      const jwtPayload = new JwtPayload({
        iss: 'iss',
        additionalClaims: {
          vp,
        },
      })

      expect(() => getPresentationFromJwtPayload(jwtPayload)).toThrow('JWT iss and vp.holder(.id) do not match')

      // nested holder object
      vp.holder = { id: '123' }
      expect(() => getPresentationFromJwtPayload(jwtPayload)).toThrow('JWT iss and vp.holder(.id) do not match')
    })

    test('throw validation error if vp is not a valid w3c vp', () => {
      const vp: Record<string, unknown> = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiablePresentation2'],
        verifiableCredential: [CredoEs256DidJwkJwtVc],
      }

      const jwtPayload = new JwtPayload({
        additionalClaims: {
          vp,
        },
      })

      expect(() => getPresentationFromJwtPayload(jwtPayload)).toThrow(
        'property type has failed the following constraints: type must be "VerifiablePresentation" or an array of strings which includes "VerifiablePresentation"'
      )
    })
  })
})
