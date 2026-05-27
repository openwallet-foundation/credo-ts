import { Kms } from '@credo-ts/core'
import { DidCommV1Service, IndyAgentService, VerificationMethod } from '../../../../../core/src/modules/dids'
import {
  DidDoc,
  Ed25119Sig2018,
  EddsaSaSigSecp256k1,
  EmbeddedAuthentication,
  ReferencedAuthentication,
  RsaSig2018,
} from '../models'
import { convertToNewDidDocument, toKeyAgreement } from '../services/helpers'

const key = new Ed25119Sig2018({
  id: 'did:sov:SKJVx2kn373FNgvff1SbJo#4',
  controller: 'did:sov:SKJVx2kn373FNgvff1SbJo',
  publicKeyBase58: 'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d',
})
const didDoc = new DidDoc({
  authentication: [
    new ReferencedAuthentication(key, 'Ed25519SignatureAuthentication2018'),
    new EmbeddedAuthentication(
      new Ed25119Sig2018({
        id: '#8',
        controller: 'did:sov:SKJVx2kn373FNgvff1SbJo',
        publicKeyBase58: '5UQ3drtEMMQXaLLmEywbciW92jZaQgRYgfuzXfonV8iz',
      })
    ),
  ],
  id: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
  publicKey: [
    key,
    new RsaSig2018({
      id: '#3',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyPem: '-----BEGIN PUBLIC X...',
    }),
    new EddsaSaSigSecp256k1({
      id: '#6',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyHex: '-----BEGIN PUBLIC A...',
    }),
  ],
  service: [
    new IndyAgentService({
      id: 'did:sov:SKJVx2kn373FNgvff1SbJo#service-1',
      serviceEndpoint: 'did:sov:SKJVx2kn373FNgvff1SbJo',
      recipientKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
      routingKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
      priority: 5,
    }),
    new DidCommV1Service({
      id: '#service-2',
      serviceEndpoint: 'https://agent.com',
      recipientKeys: ['did:sov:SKJVx2kn373FNgvff1SbJo#4', '#8'],
      routingKeys: [
        'did:key:z6MktFXxTu8tHkoE1Jtqj4ApYEg1c44qmU1p7kq7QZXBtJv1#z6MktFXxTu8tHkoE1Jtqj4ApYEg1c44qmU1p7kq7QZXBtJv1',
      ],
      priority: 2,
    }),
  ],
})

describe('convertToNewDidDocument', () => {
  test('create a new DidDocument and with authentication, publicKey and service from DidDoc', () => {
    const oldDocument = didDoc
    const newDocument = convertToNewDidDocument(oldDocument).didDocument

    expect(newDocument.authentication).toEqual(['#EoGusetS', '#5UQ3drtE'])

    expect(newDocument.verificationMethod).toEqual([
      new VerificationMethod({
        id: '#5UQ3drtE',
        type: 'Ed25519VerificationKey2018',
        controller: '#id',
        publicKeyBase58: '5UQ3drtEMMQXaLLmEywbciW92jZaQgRYgfuzXfonV8iz',
      }),
      new VerificationMethod({
        id: '#EoGusetS',
        type: 'Ed25519VerificationKey2018',
        controller: '#id',
        publicKeyBase58: 'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d',
      }),
    ])

    expect(newDocument.service).toEqual([
      new IndyAgentService({
        id: '#service-1',
        serviceEndpoint: 'did:sov:SKJVx2kn373FNgvff1SbJo',
        recipientKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        routingKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        priority: 5,
      }),
      new DidCommV1Service({
        id: '#service-2',
        serviceEndpoint: 'https://agent.com',
        recipientKeys: ['#EoGusetS', '#5UQ3drtE'],
        routingKeys: [
          'did:key:z6MktFXxTu8tHkoE1Jtqj4ApYEg1c44qmU1p7kq7QZXBtJv1#z6MktFXxTu8tHkoE1Jtqj4ApYEg1c44qmU1p7kq7QZXBtJv1',
        ],
        priority: 2,
      }),
    ])
  })

  test('will use ; as an id mark instead of # if the # is missing in a service id', () => {
    const oldDocument = new DidDoc({
      id: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      authentication: [],
      publicKey: [],
      service: [
        new IndyAgentService({
          id: 'did:sov:SKJVx2kn373FNgvff1SbJo;service-1',
          serviceEndpoint: 'did:sov:SKJVx2kn373FNgvff1SbJo',
          recipientKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
          routingKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
          priority: 5,
        }),
      ],
    })
    const newDocument = convertToNewDidDocument(oldDocument).didDocument

    expect(newDocument.service).toEqual([
      new IndyAgentService({
        id: '#service-1',
        serviceEndpoint: 'did:sov:SKJVx2kn373FNgvff1SbJo',
        recipientKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        routingKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        priority: 5,
      }),
    ])
  })

  test('will only split on the first ; or # and leave the other ones in place as id values', () => {
    const oldDocument = new DidDoc({
      id: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      authentication: [],
      publicKey: [],
      service: [
        new IndyAgentService({
          id: 'did:sov:SKJVx2kn373FNgvff1SbJo;service-1;something-extra',
          serviceEndpoint: 'did:sov:SKJVx2kn373FNgvff1SbJo',
          recipientKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
          routingKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
          priority: 6,
        }),
        new IndyAgentService({
          id: 'did:sov:SKJVx2kn373FNgvff1SbJo#service-2#something-extra',
          serviceEndpoint: 'did:sov:SKJVx2kn373FNgvff1SbJo',
          recipientKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
          routingKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
          priority: 5,
        }),
      ],
    })
    const newDocument = convertToNewDidDocument(oldDocument).didDocument

    expect(newDocument.service).toEqual([
      new IndyAgentService({
        id: '#service-1;something-extra',
        serviceEndpoint: 'did:sov:SKJVx2kn373FNgvff1SbJo',
        recipientKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        routingKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        priority: 6,
      }),
      new IndyAgentService({
        id: '#service-2#something-extra',
        serviceEndpoint: 'did:sov:SKJVx2kn373FNgvff1SbJo',
        recipientKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        routingKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        priority: 5,
      }),
    ])
  })
})

describe('toKeyAgreement', () => {
  const ed25519Fingerprint = 'z6MkmjY8GnV5i9YTDtPETC2uUAW6ejw3nk5mXF5yci5ab7th'

  const x25519Jwk = Kms.PublicJwk.fromPublicJwk({
    kty: 'OKP',
    crv: 'X25519',
    x: 'L-V9o0fNYkMVKNqsX7spBzD_9oSvxM_C7ZCZX1jLO3Q',
  })

  const p256Jwk = Kms.PublicJwk.fromPublicJwk({
    kty: 'EC',
    crv: 'P-256',
    x: 'FQVaTOksf-XsCUrt4J1L2UGvtWaDwpboVlqbKBY2AIo',
    y: '6XFB9PYo7dyC5ViJSO9uXNYkxTJWn0d_mqJ__ZYhcNY',
  })

  it('passes X25519 keys through unchanged', () => {
    const result = toKeyAgreement(x25519Jwk)
    expect(result).toBe(x25519Jwk)
    expect(result.is(Kms.X25519PublicJwk)).toBe(true)
  })

  it('passes P-256 keys through unchanged', () => {
    const result = toKeyAgreement(p256Jwk)
    expect(result).toBe(p256Jwk)
    expect(result.is(Kms.P256PublicJwk)).toBe(true)
  })

  it('birationally converts Ed25519 to X25519', () => {
    const ed25519 = Kms.PublicJwk.fromFingerprint(ed25519Fingerprint) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
    const expectedX25519 = ed25519.convertTo(Kms.X25519PublicJwk)
    const result = toKeyAgreement(ed25519)
    expect(result.is(Kms.X25519PublicJwk)).toBe(true)
    expect(result.fingerprint).toBe(expectedX25519.fingerprint)
  })

  it('throws on P-384', () => {
    const p384Jwk = Kms.PublicJwk.fromPublicJwk({
      kty: 'EC',
      crv: 'P-384',
      x: 'lInTxl8fjLKp_UCrxI0WDklcl9VuTGyM5h6yIQXVbPxBu8t-9rJW6vMzpgWf3-Pp',
      y: 'B33OmdK_FrhqAjjlZGFNlImd_5HFGtj0VyEYqsQqg2X-XnQv6KjC9X3rL5GqxKlF',
    })
    expect(() => toKeyAgreement(p384Jwk)).toThrow(/Unsupported keyAgreement curve/)
  })

  it('throws on secp256k1', () => {
    const secp256k1Jwk = Kms.PublicJwk.fromPublicJwk({
      kty: 'EC',
      crv: 'secp256k1',
      x: 'LowlbeS1Y_OWnnLrwxQRoLSY8VnGgKpAhMfeY9MEjcs',
      y: 'EmxC44wNJp_2EVUyMv-Zo2sj_HCmGRfL6QyJUkBNbHc',
    })
    expect(() => toKeyAgreement(secp256k1Jwk)).toThrow(/Unsupported keyAgreement curve/)
  })

  it('throws on RSA', () => {
    const rsaJwk = Kms.PublicJwk.fromPublicJwk({
      kty: 'RSA',
      n: 'sXchDaQebHnPiGvyDOAT4saGEUetSyo9MKLOoWFsueri23bOdgWp4Dy1WlUzewbgBHod5pcM9H95GQRV3JDXboIRROSBigeC5yjU1hGzHHyXss8UDprecbAYxknTcQkhslANGRUZmdTOQ5qTRsLAt6BTYuyvVRdhS-V3RbYJsXzYC2gAaUVqzpVOQpYpKBYV4M9bxQ_KQwgKZGUFcGuCfDQjVOmrFcSnPnk6Yn_OazPSCWNG_8VLnj4yKaP7QHWNfsTyqU6mCQc4mLdnPgcDxJX9w-uW1F-Y66z4MUmKBmGZ8ufLG3-rwPLEf25cw-IRpdyNzVf1xY83Gv2tCm7sbZw',
      e: 'AQAB',
    })
    expect(() => toKeyAgreement(rsaJwk)).toThrow(/Unsupported keyAgreement curve/)
  })

  it('includes the offending JWK description in the error message', () => {
    const p384Jwk = Kms.PublicJwk.fromPublicJwk({
      kty: 'EC',
      crv: 'P-384',
      x: 'lInTxl8fjLKp_UCrxI0WDklcl9VuTGyM5h6yIQXVbPxBu8t-9rJW6vMzpgWf3-Pp',
      y: 'B33OmdK_FrhqAjjlZGFNlImd_5HFGtj0VyEYqsQqg2X-XnQv6KjC9X3rL5GqxKlF',
    })
    expect(() => toKeyAgreement(p384Jwk)).toThrow(/P-384/)
  })
})
