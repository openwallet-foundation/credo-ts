import { ClassValidationError } from '../../../../error/ClassValidationError'
import { JsonTransformer } from '../../../../utils/JsonTransformer'
import type { Ed25519PublicJwk } from '../../../kms'
import { PublicJwk, X25519PublicJwk } from '../../../kms'
import didExample123Fixture from '../../__tests__/__fixtures__/didExample123.json'
import didExample456Invalid from '../../__tests__/__fixtures__/didExample456Invalid.json'
import { DidDocument } from '../DidDocument'
import { DidDocumentBuilder } from '../DidDocumentBuilder'
import { DidCommV1Service, DidDocumentService, IndyAgentService } from '../service'
import { VerificationMethod } from '../verificationMethod'
import { getEd25519VerificationKey2018 } from '../verificationMethod/Ed25519VerificationKey2018'
import { getX25519KeyAgreementKey2019 } from '../verificationMethod/X25519KeyAgreementKey2019'

const didDocumentInstance = new DidDocument({
  id: 'did:example:123',
  alsoKnownAs: ['did:example:456'],
  controller: ['did:example:456'],
  verificationMethod: [
    new VerificationMethod({
      id: 'did:example:123#key-1',
      type: 'RsaVerificationKey2018',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyPem: '-----BEGIN PUBLIC X...',
    }),
    new VerificationMethod({
      id: 'did:example:123#key-2',
      type: 'Ed25519VerificationKey2018',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyBase58: '-----BEGIN PUBLIC 9...',
    }),
    new VerificationMethod({
      id: 'did:example:123#key-3',
      type: 'Secp256k1VerificationKey2018',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyHex: '-----BEGIN PUBLIC A...',
    }),
  ],
  service: [
    new DidDocumentService({
      id: 'did:example:123#service-1',
      type: 'Mediator',
      serviceEndpoint: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
    }),
    new IndyAgentService({
      id: 'did:example:123#service-2',
      serviceEndpoint: 'did:sov:Q4zqM7aXqm7gDQkUVLng9h',
      recipientKeys: ['Q4zqM7aXqm7gDQkUVLng9h'],
      routingKeys: ['Q4zqM7aXqm7gDQkUVLng9h'],
      priority: 5,
    }),
    new DidCommV1Service({
      id: 'did:example:123#service-3',
      serviceEndpoint: 'https://agent.com/did-comm',
      recipientKeys: ['DADEajsDSaksLng9h'],
      routingKeys: ['DADEajsDSaksLng9h'],
      priority: 10,
    }),
  ],
  authentication: [
    'did:example:123#key-1',
    new VerificationMethod({
      id: 'did:example:123#authentication-1',
      type: 'RsaVerificationKey2018',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyPem: '-----BEGIN PUBLIC A...',
    }),
  ],
  assertionMethod: [
    'did:example:123#key-1',
    new VerificationMethod({
      id: 'did:example:123#assertionMethod-1',
      type: 'RsaVerificationKey2018',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyPem: '-----BEGIN PUBLIC A...',
    }),
  ],
  capabilityDelegation: [
    'did:example:123#key-1',
    new VerificationMethod({
      id: 'did:example:123#capabilityDelegation-1',
      type: 'RsaVerificationKey2018',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyPem: '-----BEGIN PUBLIC A...',
    }),
  ],
  capabilityInvocation: [
    'did:example:123#key-1',
    new VerificationMethod({
      id: 'did:example:123#capabilityInvocation-1',
      type: 'RsaVerificationKey2018',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyPem: '-----BEGIN PUBLIC A...',
    }),
  ],
  keyAgreement: [
    'did:example:123#key-1',
    new VerificationMethod({
      id: 'did:example:123#keyAgreement-1',
      type: 'RsaVerificationKey2018',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyPem: '-----BEGIN PUBLIC A...',
    }),
    new VerificationMethod({
      id: 'did:example:123#keyAgreement-1',
      type: 'Ed25519VerificationKey2018',
      controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
      publicKeyPem: '-----BEGIN PUBLIC A...',
    }),
  ],
})

describe('Did | DidDocument', () => {
  it('should correctly transforms Json to DidDocument class', () => {
    const didDocument = JsonTransformer.fromJSON(didExample123Fixture, DidDocument)

    // Check other properties
    expect(didDocument.id).toBe(didExample123Fixture.id)
    expect(didDocument.alsoKnownAs).toEqual(didExample123Fixture.alsoKnownAs)
    expect(didDocument.context).toEqual(didExample123Fixture['@context'])
    expect(didDocument.controller).toEqual(didExample123Fixture.controller)

    // Check verification method
    const verificationMethods = didDocument.verificationMethod ?? []
    expect(verificationMethods[0]).toBeInstanceOf(VerificationMethod)
    expect(verificationMethods[1]).toBeInstanceOf(VerificationMethod)
    expect(verificationMethods[2]).toBeInstanceOf(VerificationMethod)

    // Check Service
    const services = didDocument.service ?? []
    expect(services[0]).toBeInstanceOf(DidDocumentService)
    expect(services[1]).toBeInstanceOf(IndyAgentService)
    expect(services[2]).toBeInstanceOf(DidCommV1Service)

    // Check Authentication
    const authentication = didDocument.authentication ?? []
    expect(typeof authentication[0]).toBe('string')
    expect(authentication[1]).toBeInstanceOf(VerificationMethod)

    // Check assertionMethod
    const assertionMethod = didDocument.assertionMethod ?? []
    expect(typeof assertionMethod[0]).toBe('string')
    expect(assertionMethod[1]).toBeInstanceOf(VerificationMethod)

    // Check capabilityDelegation
    const capabilityDelegation = didDocument.capabilityDelegation ?? []
    expect(typeof capabilityDelegation[0]).toBe('string')
    expect(capabilityDelegation[1]).toBeInstanceOf(VerificationMethod)

    // Check capabilityInvocation
    const capabilityInvocation = didDocument.capabilityInvocation ?? []
    expect(typeof capabilityInvocation[0]).toBe('string')
    expect(capabilityInvocation[1]).toBeInstanceOf(VerificationMethod)

    // Check keyAgreement
    const keyAgreement = didDocument.keyAgreement ?? []
    expect(typeof keyAgreement[0]).toBe('string')
    expect(keyAgreement[1]).toBeInstanceOf(VerificationMethod)
  })

  it('validation should throw an error if the did document is invalid', () => {
    try {
      JsonTransformer.fromJSON(didExample456Invalid, DidDocument)
    } catch (error) {
      expect(error).toBeInstanceOf(ClassValidationError)
      expect(error.message).toMatch(/property type has failed the following constraints: type must be a string/)
      expect(error.validationErrors).toMatchObject([
        {
          children: [],
          constraints: {
            isString: 'type must be a string',
          },
          property: 'type',
          target: {
            controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
            id: 'did:example:123#assertionMethod-1',
            publicKeyPem: '-----BEGIN PUBLIC A...',
          },
          value: undefined,
        },
      ])
    }
  })

  it('should resolve both relative and absolute keyId combinations', () => {
    const didDocument = DidDocument.fromJSON({
      '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/jws-2020/v1'],
      id: 'did:web:verifier.dev.eduid.nl',
      verificationMethod: [
        {
          id: 'did:web:verifier.dev.eduid.nl#0',
          type: 'JsonWebKey2020',
          publicKeyJwk: {
            kty: 'EC',
            crv: 'P-256',
            kid: '02435f281d2d4a2bc2eed6a87bc24a4e7ba1f7f7276c9bc1ffdd6e27b58638d9be',
            use: 'sig',
            key_ops: ['verify'],
            alg: 'ES256',
            x: 'Q18oHS1KK8Lu1qh7wkpOe6H39ydsm8H_3W4ntYY42b4',
            y: 'zF-vLyHCwUNlVjf8xC4vgZzZ6mJFEACXe-A4jOU3YJI',
          },
          controller: 'did:web:verifier.dev.eduid.nl',
        },
      ],
      authentication: ['#0'],
      assertionMethod: ['#0'],
      capabilityDelegation: ['#0'],
      capabilityInvocation: ['#0'],
    })

    expect(didDocument.dereferenceKey('did:web:verifier.dev.eduid.nl#0', ['authentication'])).toEqual(
      didDocument.verificationMethod?.[0]
    )
  })

  it('should correctly transforms DidDoc class to Json', () => {
    const didDocumentJson = JsonTransformer.toJSON(didDocumentInstance)

    expect(didDocumentJson).toMatchObject(didExample123Fixture)
  })

  describe('getServicesByType', () => {
    it('returns all services with specified type', async () => {
      expect(didDocumentInstance.getServicesByType('IndyAgent')).toEqual(
        didDocumentInstance.service?.filter((service) => service.type === 'IndyAgent')
      )
    })
  })

  describe('getServicesByClassType', () => {
    it('returns all services with specified class', async () => {
      expect(didDocumentInstance.getServicesByClassType(IndyAgentService)).toEqual(
        didDocumentInstance.service?.filter((service) => service instanceof IndyAgentService)
      )
    })
  })

  describe('didCommServices', () => {
    it('returns all IndyAgentService and DidCommService instances', async () => {
      const services = didDocumentInstance.service ?? []

      expect(didDocumentInstance.didCommServices).toEqual(expect.arrayContaining([services[1], services[2]]))
    })

    it('returns all IndyAgentService and DidCommService instances sorted by priority', async () => {
      const services = didDocumentInstance.service ?? []

      expect(didDocumentInstance.didCommServices).toEqual([services[1], services[2]])
    })
  })

  describe('getRecipientKeysWithVerificationMethod', () => {
    it('returns a key only once when several services reference the same verification method', () => {
      const publicJwk = PublicJwk.fromFingerprint(
        'z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V'
      ) as PublicJwk<Ed25519PublicJwk>
      const verificationMethod = getEd25519VerificationKey2018({
        publicJwk,
        controller: 'did:example:alice',
        id: 'did:example:alice#key-1',
      })
      const didDocument = new DidDocumentBuilder('did:example:alice')
        .addVerificationMethod(verificationMethod)
        .addAuthentication(verificationMethod.id)
        .addService(
          new IndyAgentService({
            id: 'did:example:alice#indy',
            recipientKeys: [verificationMethod.publicKeyBase58 as string],
            serviceEndpoint: 'https://example.com/indy',
          })
        )
        .addService(
          new DidCommV1Service({
            id: 'did:example:alice#service-0',
            recipientKeys: [verificationMethod.id],
            serviceEndpoint: 'https://example.com/0',
          })
        )
        .addService(
          new DidCommV1Service({
            id: 'did:example:alice#service-1',
            recipientKeys: [verificationMethod.id],
            serviceEndpoint: 'https://example.com/1',
          })
        )
        .build()

      const recipientKeys = didDocument.getRecipientKeysWithVerificationMethod({ mapX25519ToEd25519: true })

      expect(recipientKeys).toHaveLength(1)
      expect(recipientKeys[0].verificationMethod.id).toBe('did:example:alice#key-1')
      expect(didDocument.recipientKeys.map((key) => key.fingerprint)).toEqual([publicJwk.fingerprint])
    })

    it('returns a key only once when several verification methods carry the same key', () => {
      const publicJwk = PublicJwk.fromFingerprint(
        'z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V'
      ) as PublicJwk<Ed25519PublicJwk>
      const firstVerificationMethod = getEd25519VerificationKey2018({
        publicJwk,
        controller: 'did:example:alice',
        id: 'did:example:alice#key-1',
      })
      const secondVerificationMethod = getEd25519VerificationKey2018({
        publicJwk,
        controller: 'did:example:alice',
        id: 'did:example:alice#key-2',
      })
      const didDocument = new DidDocumentBuilder('did:example:alice')
        .addVerificationMethod(firstVerificationMethod)
        .addVerificationMethod(secondVerificationMethod)
        .addAuthentication(firstVerificationMethod.id)
        .addAuthentication(secondVerificationMethod.id)
        .addService(
          new DidCommV1Service({
            id: 'did:example:alice#service-0',
            recipientKeys: [firstVerificationMethod.id, secondVerificationMethod.id],
            serviceEndpoint: 'https://example.com/0',
          })
        )
        .build()

      const recipientKeys = didDocument.getRecipientKeysWithVerificationMethod({ mapX25519ToEd25519: false })

      expect(recipientKeys).toHaveLength(1)
      expect(recipientKeys[0].verificationMethod.id).toBe('did:example:alice#key-1')
      expect(didDocument.recipientKeys.map((key) => key.fingerprint)).toEqual([publicJwk.fingerprint])
    })

    it('returns an X25519 key and its Ed25519 counterpart once when mapped to Ed25519', () => {
      const ed25519PublicJwk = PublicJwk.fromFingerprint(
        'z6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V'
      ) as PublicJwk<Ed25519PublicJwk>
      const x25519PublicJwk = ed25519PublicJwk.convertTo(X25519PublicJwk)
      const ed25519VerificationMethod = getEd25519VerificationKey2018({
        publicJwk: ed25519PublicJwk,
        controller: 'did:example:alice',
        id: 'did:example:alice#key-1',
      })
      const x25519VerificationMethod = getX25519KeyAgreementKey2019({
        publicJwk: x25519PublicJwk,
        controller: 'did:example:alice',
        id: 'did:example:alice#key-agreement-1',
      })
      const didDocument = new DidDocumentBuilder('did:example:alice')
        .addVerificationMethod(ed25519VerificationMethod)
        .addVerificationMethod(x25519VerificationMethod)
        .addAuthentication(ed25519VerificationMethod.id)
        .addKeyAgreement(x25519VerificationMethod.id)
        .addService(
          new DidCommV1Service({
            id: 'did:example:alice#service-0',
            recipientKeys: [ed25519VerificationMethod.id, x25519VerificationMethod.id],
            serviceEndpoint: 'https://example.com/0',
          })
        )
        .build()

      // Without the mapping both keys are distinct recipient keys
      expect(
        didDocument
          .getRecipientKeysWithVerificationMethod({ mapX25519ToEd25519: false })
          .map((k) => k.publicJwk.fingerprint)
      ).toEqual([ed25519PublicJwk.fingerprint, x25519PublicJwk.fingerprint])

      // With the mapping the X25519 key maps to the Ed25519 key that is already present
      const mapped = didDocument.getRecipientKeysWithVerificationMethod({ mapX25519ToEd25519: true })
      expect(mapped).toHaveLength(1)
      expect(mapped[0].publicJwk.fingerprint).toBe(ed25519PublicJwk.fingerprint)
    })
  })

  describe('findVerificationMethodsByTypeAndPurpose', () => {
    it('matches an inline method by type and relationship', () => {
      const inlineMethod = new VerificationMethod({
        id: 'did:example:123#inline-1',
        type: 'RsaVerificationKey2018',
        controller: 'did:example:123',
        publicKeyPem: '-----BEGIN PUBLIC INLINE...',
      })
      const didDocument = new DidDocument({
        id: 'did:example:123',
        verificationMethod: [inlineMethod],
        assertionMethod: [inlineMethod],
      })
      const method = didDocument.findVerificationMethodsByTypeAndPurpose('RsaVerificationKey2018', ['assertionMethod'])

      expect(method[0]?.id).toBe('did:example:123#inline-1')
    })

    it('resolves referenced methods and preserves relationship entry order', () => {
      const method = didDocumentInstance.findVerificationMethodsByTypeAndPurpose('RsaVerificationKey2018', [
        'authentication',
      ])

      expect(method[0]?.id).toBe('did:example:123#key-1')
    })

    it('matches any accepted type without using input type order as preference', () => {
      const method = didDocumentInstance.findVerificationMethodsByTypeAndPurpose(
        ['RsaVerificationKey2018', 'Ed25519VerificationKey2018'],
        ['verificationMethod']
      )

      expect(method[0]?.id).toBe('did:example:123#key-1')
    })

    it('selects matching types from a mixed assertionMethod relationship', () => {
      const ed25519Method = new VerificationMethod({
        id: 'did:example:123#ed25519-2018',
        type: 'Ed25519VerificationKey2018',
        controller: 'did:example:123',
        publicKeyBase58: 'ed25519-public-key',
      })
      const multikeyMethod = new VerificationMethod({
        id: 'did:example:123#multikey',
        type: 'Multikey',
        controller: 'did:example:123',
        publicKeyMultibase: 'z6Mk-multikey-public-key',
      })
      const authenticationMethod = new VerificationMethod({
        id: 'did:example:123#multikey-authentication',
        type: 'Multikey',
        controller: 'did:example:123',
        publicKeyMultibase: 'z6Mk-authentication-public-key',
      })
      const didDocument = new DidDocument({
        id: 'did:example:123',
        verificationMethod: [ed25519Method, multikeyMethod, authenticationMethod],
        assertionMethod: [ed25519Method.id, multikeyMethod.id],
        authentication: [authenticationMethod.id],
      })

      expect(
        didDocument
          .findVerificationMethodsByTypeAndPurpose('Ed25519VerificationKey2018', ['assertionMethod'])
          .map((method) => method.id)
      ).toEqual([ed25519Method.id])
      expect(
        didDocument.findVerificationMethodsByTypeAndPurpose('Multikey', ['authentication']).map((method) => method.id)
      ).toEqual([authenticationMethod.id])
      expect(
        didDocument.findVerificationMethodsByTypeAndPurpose('Multikey', ['assertionMethod']).map((method) => method.id)
      ).toEqual([multikeyMethod.id])
      expect(
        didDocument
          .findVerificationMethodsByTypeAndPurpose(['Multikey', 'Ed25519VerificationKey2018'], ['assertionMethod'])
          .map((method) => method.id)
      ).toEqual([ed25519Method.id, multikeyMethod.id])
      expect(didDocument.findVerificationMethodsByTypeAndPurpose('JsonWebKey2020', ['assertionMethod'])).toEqual([])
    })

    it('matches every type when no type filter is provided', () => {
      const methods = didDocumentInstance.findVerificationMethodsByPurpose(['verificationMethod'])

      expect(methods.map((method) => method.id)).toEqual([
        'did:example:123#key-1',
        'did:example:123#key-2',
        'did:example:123#key-3',
      ])
    })

    it('returns an empty array when no method matches the type and relationship', () => {
      expect(
        didDocumentInstance.findVerificationMethodsByTypeAndPurpose('Ed25519VerificationKey2018', ['authentication'])
      ).toEqual([])
    })
  })
})
