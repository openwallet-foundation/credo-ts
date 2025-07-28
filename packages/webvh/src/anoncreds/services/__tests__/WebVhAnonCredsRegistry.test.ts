import {
  type AgentContext,
  DidsApi,
  JsonTransformer,
  MultiBaseEncoder,
  MultiHashEncoder,
  TypedArrayEncoder,
} from '@credo-ts/core'
import { createHash } from 'crypto'
import { canonicalize } from 'json-canonicalize'

import { getAgentConfig, getAgentContext } from '../../../../../core/tests/helpers'
import { WebvhDidResolver, WebvhDidCrypto } from '../../../dids'
import { WebVhResource } from '../../utils/transform'
import { WebVhAnonCredsRegistry } from '../WebVhAnonCredsRegistry'

import { mockSchemaResource, mockCredDefResource, mockRevRegDefResource } from './mock-resources'

// Mock the WebvhDidResolver
const mockResolveResource = jest.fn()
jest.mock('../../../dids/WebvhDidResolver', () => {
  return {
    WebvhDidResolver: jest.fn().mockImplementation(() => {
      return { resolveResource: mockResolveResource }
    }),
  }
})

// Mock DidsApi
const mockResolveDidDocument = jest.fn()
const mockDidsApi = {
  resolveDidDocument: mockResolveDidDocument,
}

// Mock WebvhDidCrypto verify function
const mockCryptoVerify = jest.fn()

describe('WebVhAnonCredsRegistry', () => {
  let agentContext: AgentContext
  let registry: WebVhAnonCredsRegistry

  beforeEach(() => {
    // Reset the mocks before each test
    mockResolveResource.mockReset()
    mockResolveDidDocument.mockReset()

    mockCryptoVerify.mockReset()

    const agentConfig = getAgentConfig('WebVhAnonCredsRegistryTest')
    agentContext = getAgentContext({
      agentConfig,
      registerInstances: [
        [DidsApi, mockDidsApi],
        [WebvhDidResolver, { resolveResource: mockResolveResource }],
      ],
    })

    // Default mock for verifyProof to return true (will be overridden in verifyProof tests)
    jest.spyOn(WebVhAnonCredsRegistry.prototype, 'verifyProof').mockResolvedValue(true)

    registry = new WebVhAnonCredsRegistry()
  })

  describe('getSchema', () => {
    it('should correctly resolve and parse a valid schema using MockSchemaResource', async () => {
      const schemaId = mockSchemaResource.id

      const mockResolverResponse = {
        content: mockSchemaResource,
        contentMetadata: mockSchemaResource.metadata || {},
        dereferencingMetadata: { contentType: 'application/json' },
      }

      mockResolveResource.mockResolvedValue(mockResolverResponse)

      const result = await registry.getSchema(agentContext, schemaId)

      const expectedIssuerId = schemaId.substring(0, schemaId.lastIndexOf('/resources/'))

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      expect(result).toEqual({
        schema: {
          attrNames: mockSchemaResource.content.attrNames,
          name: mockSchemaResource.content.name,
          version: mockSchemaResource.content.version,
          issuerId: expectedIssuerId,
        },
        schemaId,
        resolutionMetadata: mockResolverResponse.dereferencingMetadata,
        schemaMetadata: mockSchemaResource.metadata,
      })
    })

    it('should return resolutionMetadata with error if schemaId does not match supported pattern', async () => {
      const invalidSchemaId = 'invalid-schema-id'
      const result = await registry.getSchema(agentContext, invalidSchemaId)

      expect(mockResolveResource).not.toHaveBeenCalled()
      expect(result).toEqual({
        schemaId: invalidSchemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining(`Invalid schema ID: ${invalidSchemaId}`),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if resolver fails to resolve', async () => {
      const schemaId = 'did:webvh:example.com:resource:schema/somehash'
      const errorMessage = 'Resource not found on server'
      // Simulate resolver returning an error structure
      mockResolveResource.mockResolvedValue({
        error: 'notFound',
        message: errorMessage,
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining(
            `Resource ${schemaId} could not be resolved or is missing data. Error: notFound - ${errorMessage}`
          ),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if resolved data is not valid JSON', async () => {
      const schemaId = 'did:webvh:example.com:resource:schema/jsonhash'
      mockResolveResource.mockResolvedValue({
        content: { data: 'invalid json' },
        contentMetadata: {},
        dereferencingMetadata: {},
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('Failed to parse resource data'),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if resource is not attested', async () => {
      const schemaContent = { attrNames: ['a'], name: 'N', version: 'V' }
      const contentString = canonicalize(schemaContent)
      const digestBuffer = createHash('sha256').update(contentString).digest()
      const multibaseHash = MultiHashEncoder.encode(digestBuffer, 'sha-256')
      const schemaId = `did:webvh:example.com:resource:noattest/${multibaseHash}`

      const mockWebResource = {
        ...mockSchemaResource,
        type: 'IncorrectType',
      }
      mockResolveResource.mockResolvedValue({
        content: mockWebResource,
        contentMetadata: {},
        dereferencingMetadata: {},
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('Resolved resource data is not attested'),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if proof validation fails (placeholder)', async () => {
      // Use a type assertion to access the private method for mocking
      const verifyProofSpy = jest.spyOn(WebVhAnonCredsRegistry.prototype, 'verifyProof')
      verifyProofSpy.mockResolvedValueOnce(false)

      const schemaContent = { attrNames: ['a'], name: 'N', version: 'V' }
      const contentString = canonicalize(schemaContent)
      const digestBuffer = createHash('sha256').update(contentString).digest()
      const multibaseHash = MultiBaseEncoder.encode(MultiHashEncoder.encode(digestBuffer, 'sha-256'), 'base58btc')
      const schemaId = `did:webvh:example.com:resource:badproof/${multibaseHash}`

      const mockWebResource = {
        type: ['AttestedResource'],
        proof: {
          // Ensure a complete proof object is here, even if values are dummy
          type: 'BadProof',
          cryptosuite: 'dummy-suite',
          proofPurpose: 'assertionMethod',
          proofValue: 'dummy-value',
          verificationMethod: 'dummy-vm',
        },
        content: schemaContent,
        id: schemaId,
        '@context': ['https://w3id.org/security/data-integrity/v2'],
      }
      mockResolveResource.mockResolvedValue({
        content: mockWebResource, // Provide the full resource here
        contentMetadata: {},
        dereferencingMetadata: { contentType: 'application/json' },
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      // Expect the 'invalid' error due to verifyProof returning false
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('Resolved resource proof is invalid'),
        },
        schemaMetadata: {},
      })
      // Restore the original method if needed elsewhere
      verifyProofSpy.mockRestore()
    })

    it('should return resolutionMetadata with error if content hash does not match schemaId', async () => {
      const schemaContent = { attrNames: ['a'], name: 'N', version: 'V' }
      const wrongMultibaseHash = 'zQmWrongHash123' // Keep this wrong hash
      const schemaId = `did:webvh:example.com:resource:wronghash/${wrongMultibaseHash}`

      const mockWebResource = {
        type: ['AttestedResource'],
        proof: {
          // Add complete proof object
          type: 'ExampleProof',
          cryptosuite: 'eddsa-jcs-2022',
          proofPurpose: 'assertionMethod',
          proofValue: 'z4RCLxRSVeTM4UnZ6vDmDjEX9pbpdUptXuDTy7h8Fij2npReHXmCUzzb5jTEUg1dFtpjH7tiKNJwXztwSktdjaMtX',
          verificationMethod: 'did:webvh:example#key-1',
        },
        content: schemaContent,
        id: schemaId, // Use the ID with the wrong hash
        '@context': ['https://w3id.org/security/data-integrity/v2'],
      }
      mockResolveResource.mockResolvedValue({
        content: mockWebResource, // Provide the full resource
        contentMetadata: {},
        dereferencingMetadata: { contentType: 'application/json' },
        // No top-level error needed as the error happens after resolution
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      // Expect the 'invalid' error due to hash mismatch
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('Content hash mismatch'),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if parsed content is missing required fields', async () => {
      const incompleteContent = {
        issuerId: 'did:webvh:example.com:resource:incomplete',
        name: 'TestSchema',
        version: '1.0',
      }
      const contentString = canonicalize(incompleteContent)
      const contentBuffer = TypedArrayEncoder.fromString(contentString)
      const multibaseHash = MultiBaseEncoder.encode(MultiHashEncoder.encode(contentBuffer, 'sha-256'), 'base58btc')
      const schemaId = `did:webvh:example.com:resource:incomplete/${multibaseHash}`

      const mockWebResource = {
        type: ['AttestedResource'],
        proof: {
          // Add complete proof object
          type: 'ExampleProof',
          cryptosuite: 'eddsa-jcs-2022',
          proofPurpose: 'assertionMethod',
          proofValue: 'z4RCLxRSVeTM4UnZ6vDmDjEX9pbpdUptXuDTy7h8Fij2npReHXmCUzzb5jTEUg1dFtpjH7tiKNJwXztwSktdjaMtX',
          verificationMethod: 'did:webvh:example#key-1',
        },
        content: incompleteContent, // Provide the incomplete content
        id: schemaId,
        '@context': ['https://w3id.org/security/data-integrity/v2'],
      }
      mockResolveResource.mockResolvedValue({
        content: mockWebResource, // Provide the full resource
        contentMetadata: {},
        dereferencingMetadata: { contentType: 'application/json' },
        // No top-level error needed as the error happens after resolution
      })

      const result = await registry.getSchema(agentContext, schemaId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      // Expect the 'invalid' error due to missing schema fields
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('not a valid schema'), // Updated message check
        },
        schemaMetadata: {},
      })
    })
  })

  describe('getCredentialDefinition', () => {
    it('should return resolutionMetadata with error for invalid prefix (tested via helper)', async () => {
      const credDefId = 'did:web:example.com/resource/credDef123' // Invalid prefix for this registry

      // We expect the helper function to throw before specific logic is hit
      const result = await registry.getCredentialDefinition(agentContext, credDefId)

      // Expect the error thrown by the helper function
      expect(result.resolutionMetadata.error).toBe('invalid')
      expect(result.resolutionMetadata.message).toContain(`Invalid credential definition ID: ${credDefId}`)
      expect(mockResolveResource).not.toHaveBeenCalled() // Resolver shouldn't be called if prefix check fails
    })

    it('should return resolutionMetadata with error if credentialDefinitionId is invalid (tested via helper)', async () => {
      const invalidCredDefId = 'did:webvh:invalid-id' // Correct prefix, but might fail later

      // Mock the resolver to return a specific error for this ID to simulate a resolution failure
      // Or let it proceed and expect failure during validation within the helper
      // Here, we test the helper's initial ID format check
      mockResolveResource.mockResolvedValue({ error: 'notFound', message: 'Simulated resolution failure' })

      const result = await registry.getCredentialDefinition(agentContext, invalidCredDefId)

      // The helper WILL call the resolver, but the resolution fails.
      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, invalidCredDefId)

      // Expect the error propagated from the helper/resolver
      expect(result.resolutionMetadata.error).toBe('invalid')
      expect(result.resolutionMetadata.message).toContain('could not be resolved or is missing data')
    })
  })

  describe('getRevocationRegistryDefinition', () => {
    it('should correctly resolve and parse a valid RevRegDef resource', async () => {
      const revRegDefId = mockRevRegDefResource.id
      const mockResolverResponse = {
        content: mockRevRegDefResource,
        contentMetadata: mockRevRegDefResource.metadata || {},
        dereferencingMetadata: { contentType: 'application/json' },
      }

      mockResolveResource.mockResolvedValue(mockResolverResponse)

      // We need to mock verifyProof to return true for this test
      const verifyProofSpy = jest.spyOn(WebVhAnonCredsRegistry.prototype, 'verifyProof')
      verifyProofSpy.mockResolvedValue(true)

      const result = await registry.getRevocationRegistryDefinition(agentContext, revRegDefId)

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, revRegDefId)
      expect(verifyProofSpy).toHaveBeenCalled()
      expect(result.resolutionMetadata.error).toBeUndefined()
      expect(result.revocationRegistryDefinition).toBeDefined()
      expect(result.revocationRegistryDefinition?.issuerId).toBe(mockRevRegDefResource.content.issuerId)
      expect(result.revocationRegistryDefinition?.revocDefType).toBe(mockRevRegDefResource.content.revocDefType)
      expect(result.revocationRegistryDefinition?.credDefId).toBe(mockRevRegDefResource.content.credDefId)
      expect(result.revocationRegistryDefinition?.tag).toBe(mockRevRegDefResource.content.tag)
      expect(result.revocationRegistryDefinition?.value).toEqual(mockRevRegDefResource.content.value)
      expect(result.revocationRegistryDefinitionMetadata).toEqual(mockRevRegDefResource.metadata)
      expect(result.resolutionMetadata).toEqual(mockResolverResponse.dereferencingMetadata)

      verifyProofSpy.mockRestore()
    })

    // Add more tests for error cases (invalid ID, not found, hash mismatch, invalid content etc.)
    // similar to the getSchema tests
  })

  describe('Resource Transformation', () => {
    it('should correctly transform a schema resource', () => {
      const resource = JsonTransformer.fromJSON(mockSchemaResource, WebVhResource)

      expect(resource).toBeInstanceOf(WebVhResource)
      expect(resource['@context']).toEqual(['https://w3id.org/security/data-integrity/v2'])
      expect(resource.type).toEqual(['AttestedResource'])

      // Type guard to check if content is a schema
      if ('attrNames' in resource.content) {
        expect(resource.content.name).toBe('Meeting Invitation')
        expect(resource.content.version).toBe('1.1')
        expect(Array.isArray(resource.content.attrNames)).toBe(true)
        expect(resource.content.attrNames).toContain('email')
      } else {
        // This should not happen in this test
        fail('Content should be a schema')
      }
    })

    it('should correctly transform a credential definition resource', () => {
      const resource = JsonTransformer.fromJSON(mockCredDefResource, WebVhResource)

      expect(resource).toBeInstanceOf(WebVhResource)
      expect(resource['@context']).toEqual(['https://w3id.org/security/data-integrity/v2'])
      expect(resource.type).toEqual(['AttestedResource'])

      // Type guard to check if content is a credential definition
      if ('schemaId' in resource.content) {
        expect(resource.content.type).toBe('CL')
        expect(resource.content.tag).toBe('Meeting Invitation')
        expect(resource.content.schemaId).toContain('zQmc3ZT6N3s3UhqTcC5kWcWVoHwnkK6dZVBVfkLtYKY8YJm')
      } else {
        // This should not happen in this test
        fail('Content should be a credential definition')
      }
    })
  })

  describe('verifyProof', () => {
    const mockDidDocument = {
      id: 'did:webvh:example.com',
      verificationMethod: [
        {
          id: 'did:webvh:example.com#key-1',
          type: 'Ed25519VerificationKey2020',
          controller: 'did:webvh:example.com',
          publicKeyMultibase: 'z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
        },
      ],
    }

    beforeEach(() => {
      // Clear the default verifyProof mock for these tests
      jest.restoreAllMocks()

      // Re-setup the dependency manager mocks
      const originalResolve = agentContext.dependencyManager.resolve.bind(agentContext.dependencyManager)
      agentContext.dependencyManager.resolve = jest.fn().mockImplementation((token) => {
        const tokenString = token?.name || token?.toString?.() || String(token)

        if (tokenString.includes('DidsApi')) {
          return mockDidsApi
        }
        if (token === WebvhDidResolver || tokenString.includes('WebvhDidResolver')) {
          return { resolveResource: mockResolveResource }
        }
        return originalResolve(token)
      })

      // Mock successful DID resolution
      mockResolveDidDocument.mockResolvedValue(mockDidDocument)

      // Mock successful signature verification
      jest.spyOn(WebvhDidCrypto.prototype, 'verify').mockImplementation(mockCryptoVerify)
      mockCryptoVerify.mockResolvedValue(true)
    })

    it('should return true for valid DataIntegrityProof with eddsa-jcs-2022', async () => {
      const validProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:webvh:example.com#key-1',
        proofValue: 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz',
        proofPurpose: 'assertionMethod',
        created: '2023-01-01T00:00:00Z',
      }

      const content = { test: 'data', someField: 'value' }

      const result = await registry.verifyProof(agentContext, validProof, content)

      expect(result).toBe(true)
      expect(mockResolveDidDocument).toHaveBeenCalledWith('did:webvh:example.com#key-1')
      expect(mockCryptoVerify).toHaveBeenCalled()
    })

    it('should return false for null proof', async () => {
      const result = await registry.verifyProof(agentContext, null, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false for undefined proof', async () => {
      const result = await registry.verifyProof(agentContext, undefined, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false for non-object proof', async () => {
      const result = await registry.verifyProof(agentContext, 'not an object', {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false for wrong proof type', async () => {
      const invalidProof = {
        type: 'WrongProofType',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:webvh:example.com#key-1',
        proofValue: 'validSignature',
      }

      const result = await registry.verifyProof(agentContext, invalidProof, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false for wrong cryptosuite', async () => {
      const invalidProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'wrong-cryptosuite',
        verificationMethod: 'did:webvh:example.com#key-1',
        proofValue: 'validSignature',
      }

      const result = await registry.verifyProof(agentContext, invalidProof, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false for missing verificationMethod', async () => {
      const invalidProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        proofValue: 'validSignature',
      }

      const result = await registry.verifyProof(agentContext, invalidProof, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false for invalid verificationMethod type', async () => {
      const invalidProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 123, // Should be string
        proofValue: 'validSignature',
      }

      const result = await registry.verifyProof(agentContext, invalidProof, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false for missing proofValue', async () => {
      const invalidProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:webvh:example.com#key-1',
      }

      const result = await registry.verifyProof(agentContext, invalidProof, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false for invalid proofValue type', async () => {
      const invalidProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:webvh:example.com#key-1',
        proofValue: 123, // Should be string
      }

      const result = await registry.verifyProof(agentContext, invalidProof, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).not.toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false when DID resolution fails', async () => {
      const validProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:webvh:example.com#key-1',
        proofValue: 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz',
      }

      // Mock DID resolution failure
      mockResolveDidDocument.mockResolvedValue({
        didDocument: null,
        didResolutionMetadata: { error: 'notFound' },
        didDocumentMetadata: {},
      })

      const result = await registry.verifyProof(agentContext, validProof, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false when verification method not found in DID document', async () => {
      const validProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:webvh:example.com#nonexistent-key',
        proofValue: 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz',
      }

      const result = await registry.verifyProof(agentContext, validProof, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).toHaveBeenCalled()
      expect(mockCryptoVerify).not.toHaveBeenCalled()
    })

    it('should return false when signature verification fails', async () => {
      const validProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:webvh:example.com#key-1',
        proofValue: 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz',
      }

      // Mock signature verification failure
      mockCryptoVerify.mockResolvedValue(false)

      const result = await registry.verifyProof(agentContext, validProof, {})
      expect(result).toBe(false)
      expect(mockResolveDidDocument).toHaveBeenCalled()
      expect(mockCryptoVerify).toHaveBeenCalled()
    })

    it('should handle proof without optional fields', async () => {
      const minimalProof = {
        type: 'DataIntegrityProof',
        cryptosuite: 'eddsa-jcs-2022',
        verificationMethod: 'did:webvh:example.com#key-1',
        proofValue: 'z58DAdFfa9SkqZMVPxAQpic7ndSayn1PzZs6ZjWp1CktyGesjuTSwRdoWhAfGFCF5bppETSTojQCrfFPP2oumHKtz',
        // No proofPurpose or created fields
      }

      const content = { test: 'data' }

      const result = await registry.verifyProof(agentContext, minimalProof, content)

      expect(result).toBe(true)
      expect(mockResolveDidDocument).toHaveBeenCalled()
      expect(mockCryptoVerify).toHaveBeenCalled()
    })
  })
})
