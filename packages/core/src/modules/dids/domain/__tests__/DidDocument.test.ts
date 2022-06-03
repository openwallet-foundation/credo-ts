import { JsonTransformer } from '../../../../utils/JsonTransformer'
import { MessageValidator } from '../../../../utils/MessageValidator'
import didExample123Fixture from '../../__tests__/__fixtures__/didExample123.json'
import didExample456Invalid from '../../__tests__/__fixtures__/didExample456Invalid.json'
import { DidDocument, findVerificationMethodByKeyType } from '../DidDocument'
import { DidDocumentService, IndyAgentService, DidCommV1Service } from '../service'
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

      expect(didDocumentInstance.didCommServices).toEqual([services[2], services[1]])
    })
  })

  describe('findVerificationMethodByKeyType', () => {
    it('return first verfication method that match key type', async () => {
      expect(await findVerificationMethodByKeyType('Ed25519VerificationKey2018', didDocumentInstance)).toBeInstanceOf(
        VerificationMethod
      )
    })
  })
})
