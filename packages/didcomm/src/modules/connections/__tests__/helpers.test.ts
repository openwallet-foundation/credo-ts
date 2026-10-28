import { Subject } from 'rxjs'
import { InMemoryStorageService } from '../../../../../../tests/InMemoryStorageService'
import { EventEmitter } from '../../../../../core/src/agent/EventEmitter'
import { CredoError } from '../../../../../core/src/error'
import {
  DidCommV1Service,
  DidDocumentRole,
  DidRecord,
  DidRepository,
  IndyAgentService,
  VerificationMethod,
} from '../../../../../core/src/modules/dids'
import { PublicJwk } from '../../../../../core/src/modules/kms'
import { agentDependencies, getAgentContext } from '../../../../../core/tests/helpers'
import {
  DidDoc,
  Ed25119Sig2018,
  EddsaSaSigSecp256k1,
  EmbeddedAuthentication,
  ReferencedAuthentication,
  RsaSig2018,
} from '../models'
import { assertNoCreatedDidExistsForKeys, convertToNewDidDocument } from '../services/helpers'

describe('assertNoCreatedDidExistsForKeys', () => {
  const keys = [1, 2, 3].map((value) =>
    PublicJwk.fromPublicKey({
      kty: 'OKP',
      crv: 'Ed25519',
      publicKey: new Uint8Array(32).fill(value),
    })
  )

  const setup = () => {
    const repository = new DidRepository(
      new InMemoryStorageService<DidRecord>(),
      new EventEmitter(agentDependencies, new Subject())
    )
    const context = getAgentContext({ registerInstances: [[DidRepository, repository]] })
    return { context, repository }
  }

  test('allows unused keys and keys found only on received DIDs with fingerprint-only queries', async () => {
    const { context, repository } = setup()
    await repository.save(
      context,
      new DidRecord({
        did: 'did:example:received',
        role: DidDocumentRole.Received,
        tags: { recipientKeyFingerprints: [keys[0].fingerprint] },
      })
    )
    const query = vi.spyOn(repository, 'findByQuery')

    await expect(assertNoCreatedDidExistsForKeys(context, keys)).resolves.toBeUndefined()
    expect(query.mock.calls).toEqual(keys.map((key) => [context, { recipientKeyFingerprints: [key.fingerprint] }]))
  })

  test('rejects reused keys and reports all matching fingerprints once', async () => {
    const { context, repository } = setup()
    for (const id of ['first', 'second']) {
      await repository.save(
        context,
        new DidRecord({
          did: `did:example:${id}`,
          role: DidDocumentRole.Created,
          tags: { recipientKeyFingerprints: [keys[0].fingerprint, keys[2].fingerprint] },
        })
      )
    }
    const query = vi.spyOn(repository, 'findByQuery')
    const result = assertNoCreatedDidExistsForKeys(context, [...keys, keys[0]])
    await expect(result).rejects.toThrow(CredoError)
    await expect(result).rejects.toThrow(
      `The following fingerprints are already in use: ${keys[0].fingerprint},${keys[2].fingerprint}`
    )
    expect(query).toHaveBeenCalledTimes(3)
  })

  test('runs fingerprint lookups sequentially and queries duplicate keys only once', async () => {
    const { context, repository } = setup()
    const query = vi.spyOn(repository, 'findByQuery').mockImplementation(async () => {
      const callCount = query.mock.calls.length
      await Promise.resolve()
      expect(query).toHaveBeenCalledTimes(callCount)
      return []
    })

    await assertNoCreatedDidExistsForKeys(context, [...keys, ...keys])
    expect(query.mock.calls).toEqual(keys.map((key) => [context, { recipientKeyFingerprints: [key.fingerprint] }]))
  })

  test('does not resolve storage for an empty key list', async () => {
    const { context, repository } = setup()
    const resolve = vi.spyOn(context.dependencyManager, 'resolve')
    const query = vi.spyOn(repository, 'findByQuery')

    await expect(assertNoCreatedDidExistsForKeys(context, [])).resolves.toBeUndefined()
    expect(resolve).not.toHaveBeenCalled()
    expect(query).not.toHaveBeenCalled()
  })

  test('propagates storage errors rather than allowing key reuse', async () => {
    const { context, repository } = setup()
    vi.spyOn(repository, 'findByQuery').mockRejectedValue(new Error('storage unavailable'))
    await expect(assertNoCreatedDidExistsForKeys(context, keys)).rejects.toThrow('storage unavailable')
  })
})

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
