import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import didExample123Fixture from '../../__tests__/__fixtures__/didExample123.json'
import didExample456Invalid from '../../__tests__/__fixtures__/didExample456Invalid.json'
import { DidDocument } from '../DidDocument'
import { DidDocumentService, IndyAgentService, DidCommService } from '../service'
import { VerificationMethod } from '../verificationMethod'

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
    new DidCommService({
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
    expect(didDocument.verificationMethod[0]).toBeInstanceOf(VerificationMethod)
    expect(didDocument.verificationMethod[1]).toBeInstanceOf(VerificationMethod)
    expect(didDocument.verificationMethod[2]).toBeInstanceOf(VerificationMethod)

    // Check Service
    expect(didDocument.service[0]).toBeInstanceOf(DidDocumentService)
    expect(didDocument.service[1]).toBeInstanceOf(IndyAgentService)
    expect(didDocument.service[2]).toBeInstanceOf(DidCommService)

    // Check Authentication
    expect(typeof didDocument.authentication[0]).toBe('string')
    expect(didDocument.authentication[1]).toBeInstanceOf(VerificationMethod)

    // Check assertionMethod
    expect(typeof didDocument.assertionMethod[0]).toBe('string')
    expect(didDocument.assertionMethod[1]).toBeInstanceOf(VerificationMethod)

    // Check capabilityDelegation
    expect(typeof didDocument.capabilityDelegation[0]).toBe('string')
    expect(didDocument.capabilityDelegation[1]).toBeInstanceOf(VerificationMethod)

    // Check capabilityInvocation
    expect(typeof didDocument.capabilityInvocation[0]).toBe('string')
    expect(didDocument.capabilityInvocation[1]).toBeInstanceOf(VerificationMethod)

    // Check keyAgreement
    expect(typeof didDocument.keyAgreement[0]).toBe('string')
    expect(didDocument.keyAgreement[1]).toBeInstanceOf(VerificationMethod)
  })

  it('validation should throw an error if the did document is invalid', async () => {
    const didDocument = JsonTransformer.fromJSON(didExample456Invalid, DidDocument)

    try {
      await MessageValidator.validate(didDocument)
    } catch (error) {
      expect(error).toMatchObject([
        {
          value: 'did:example:123',
          property: 'alsoKnownAs',
          children: [],
          constraints: { isArray: 'alsoKnownAs must be an array' },
        },
        {
          value: [
            'did:example:456#key-1',
            {
              id: 'did:example:456#key-2',
              type: 'Ed25519VerificationKey2018',
              controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
              publicKeyBase58: '-----BEGIN PUBLIC 9...',
            },
            {
              id: 'did:example:456#key-3',
              controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
              publicKeyHex: '-----BEGIN PUBLIC A...',
            },
          ],
          property: 'verificationMethod',
          children: [
            {
              target: [
                'did:example:456#key-1',
                {
                  id: 'did:example:456#key-2',
                  type: 'Ed25519VerificationKey2018',
                  controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
                  publicKeyBase58: '-----BEGIN PUBLIC 9...',
                },
                {
                  id: 'did:example:456#key-3',
                  controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
                  publicKeyHex: '-----BEGIN PUBLIC A...',
                },
              ],
              value: 'did:example:456#key-1',
              property: '0',
              children: [
                {
                  value: 'did:example:456#key-1',
                  property: 'verificationMethod',
                  constraints: {
                    nestedValidation: 'each value in nested property verificationMethod must be either object or array',
                  },
                },
              ],
            },
            {
              target: [
                'did:example:456#key-1',
                {
                  id: 'did:example:456#key-2',
                  type: 'Ed25519VerificationKey2018',
                  controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
                  publicKeyBase58: '-----BEGIN PUBLIC 9...',
                },
                {
                  id: 'did:example:456#key-3',
                  controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
                  publicKeyHex: '-----BEGIN PUBLIC A...',
                },
              ],
              value: {
                id: 'did:example:456#key-3',
                controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
                publicKeyHex: '-----BEGIN PUBLIC A...',
              },
              property: '2',
              children: [
                {
                  target: {
                    id: 'did:example:456#key-3',
                    controller: 'did:sov:LjgpST2rjsoxYegQDRm7EL',
                    publicKeyHex: '-----BEGIN PUBLIC A...',
                  },
                  property: 'type',
                  children: [],
                  constraints: { isString: 'type must be a string' },
                },
              ],
            },
          ],
        },
      ])
    }
  })

  it('should correctly transforms DidDoc class to Json', () => {
    const didDocumentJson = JsonTransformer.toJSON(didDocumentInstance)

    expect(didDocumentJson).toMatchObject(didExample123Fixture)
  })

  describe('getServicesByType', () => {
    it('returns all services with specified type', async () => {
      expect(didDocumentInstance.getServicesByType('IndyAgent')).toEqual(
        didDocumentInstance.service.filter((service) => service.type === 'IndyAgent')
      )
    })
  })

  describe('getServicesByClassType', () => {
    it('returns all services with specified class', async () => {
      expect(didDocumentInstance.getServicesByClassType(IndyAgentService)).toEqual(
        didDocumentInstance.service.filter((service) => service instanceof IndyAgentService)
      )
    })
  })

  describe('didCommServices', () => {
    it('returns all IndyAgentService and DidCommService instances', async () => {
      expect(didDocumentInstance.didCommServices).toEqual(
        expect.arrayContaining([didDocumentInstance.service[1], didDocumentInstance.service[2]])
      )
    })

    it('returns all IndyAgentService and DidCommService instances sorted by priority', async () => {
      expect(didDocumentInstance.didCommServices).toEqual([
        didDocumentInstance.service[2],
        didDocumentInstance.service[1],
      ])
    })
  })
})
