import { IndyAgentService, VerificationMethod } from '../../dids'
import { DidDoc, Ed25119Sig2018, EddsaSaSigSecp256k1, EmbeddedAuthentication, RsaSig2018 } from '../models'
import { convertToNewDidDocument } from '../services/helpers'

const didDoc = new DidDoc({
  authentication: [
    new EmbeddedAuthentication(
      new Ed25119Sig2018({
        id: 'did:sov:SKJVx2kn373FNgvff1SbJo#4',
        controller: 'did:sov:SKJVx2kn373FNgvff1SbJo',
        publicKeyBase58: 'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d',
      })
    ),
  ],
  id: 'test-id',
  publicKey: [
    new RsaSig2018({
      id: '3',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyPem: '-----BEGIN PUBLIC X...',
    }),
    new Ed25119Sig2018({
      id: 'did:sov:SKJVx2kn373FNgvff1SbJo#4',
      controller: 'did:sov:SKJVx2kn373FNgvff1SbJo',
      publicKeyBase58: 'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d',
    }),
    new EddsaSaSigSecp256k1({
      id: '6',
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
  ],
})

describe('convertToNewDidDocument', () => {
  test('create a new DidDocument and with authentication, publicKey and service from DidDoc', () => {
    const oldDocument = didDoc
    const newDocument = convertToNewDidDocument(oldDocument)

    expect(newDocument.authentication).toEqual([
      new VerificationMethod({
        id: 'did:sov:SKJVx2kn373FNgvff1SbJo#4',
        type: 'Ed25519VerificationKey2018',
        controller: 'did:sov:SKJVx2kn373FNgvff1SbJo',
        publicKeyBase58: 'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d',
      }),
    ])

    expect(newDocument.verificationMethod).toEqual([
      new VerificationMethod({
        id: 'did:sov:SKJVx2kn373FNgvff1SbJo#4',
        type: 'Ed25519VerificationKey2018',
        controller: 'did:sov:SKJVx2kn373FNgvff1SbJo',
        publicKeyBase58: 'EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d',
      }),
    ])

    expect(newDocument.service).toEqual([
      new IndyAgentService({
        id: 'did:sov:SKJVx2kn373FNgvff1SbJo#service-1',
        serviceEndpoint: 'did:sov:SKJVx2kn373FNgvff1SbJo',
        recipientKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        routingKeys: ['EoGusetSxDJktp493VCyh981nUnzMamTRjvBaHZAy68d'],
        priority: 5,
      }),
    ])
  })
})
