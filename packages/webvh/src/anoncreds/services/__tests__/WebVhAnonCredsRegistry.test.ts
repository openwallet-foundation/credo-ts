import { JsonTransformer } from '@credo-ts/core'
import { createHash } from 'crypto'
import { canonicalize } from 'json-canonicalize'

import { getAgentConfig, getAgentContext } from '../../../../../core/tests/helpers'
import { WebvhDidResolver } from '../../../dids'
import { encodeMultihash } from '../../utils/multihash'
import { WebVhResource } from '../../utils/transform'
import { WebVhAnonCredsRegistry } from '../WebVhAnonCredsRegistry'

import { MockSchemaResource, MockCredDefResource, MockRevRegDefResource } from './mock-resources'
 
// Mock the WebvhDidResolver
const mockResolveResource = jest.fn()
jest.mock('../../../dids/WebvhDidResolver', () => {
  return {
    WebvhDidResolver: jest.fn().mockImplementation(() => {
      return { resolveResource: mockResolveResource }
    }),
  }
})

describe('WebVhAnonCredsRegistry', () => {
  let agentContext: any
  let registry: WebVhAnonCredsRegistry

  beforeEach(() => {
    // Reset the mock before each test
    mockResolveResource.mockReset()

    const agentConfig = getAgentConfig('WebVhAnonCredsRegistryTest')
    agentContext = getAgentContext({ agentConfig })
    // Register the mocked resolver instance
    agentContext.dependencyManager.registerInstance(WebvhDidResolver, new WebvhDidResolver())
    registry = new WebVhAnonCredsRegistry()
  })

  describe('getSchema', () => {
    it('should correctly resolve and parse a valid schema using MockSchemaResource', async () => {
      const schemaId = MockSchemaResource.id

      const mockResolverResponse = {
        content: MockSchemaResource,
        contentMetadata: MockSchemaResource.metadata || {},
        dereferencingMetadata: { contentType: 'application/json' },
      }

      mockResolveResource.mockResolvedValue(mockResolverResponse)

      const result = await registry.getSchema(agentContext, schemaId)

      const expectedIssuerId = schemaId.substring(0, schemaId.lastIndexOf('/resources/'))

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, schemaId)
      expect(result).toEqual({
        schema: {
          attrNames: MockSchemaResource.content.attrNames,
          name: MockSchemaResource.content.name,
          version: MockSchemaResource.content.version,
          issuerId: expectedIssuerId,
        },
        schemaId,
        resolutionMetadata: mockResolverResponse.dereferencingMetadata,
        schemaMetadata: MockSchemaResource.metadata,
      })
    })

    it('should return resolutionMetadata with error if schemaId does not match supported pattern', async () => {
      const invalidSchemaId = 'invalid-schema-id'
      const result = await registry.getSchema(agentContext, invalidSchemaId)

      expect(mockResolveResource).not.toHaveBeenCalled()
      expect(result).toEqual({
        schemaId: invalidSchemaId,
        resolutionMetadata: {
          error: 'invalidDid',
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
          error: 'notFound',
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
          error: 'invalidJson',
          message: expect.stringContaining('Failed to parse resource data'),
        },
        schemaMetadata: {},
      })
    })

    it('should return resolutionMetadata with error if resource is not attested', async () => {
      const schemaContent = { attrNames: ['a'], name: 'N', version: 'V' }
      const contentString = canonicalize(schemaContent)
      const digestBuffer = createHash('sha256').update(contentString).digest()
      const multibaseHash = encodeMultihash(digestBuffer)
      const schemaId = `did:webvh:example.com:resource:noattest/${multibaseHash}`

      const mockWebResource = {
        ...MockSchemaResource,
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
      const validateProofSpy = jest.spyOn(WebVhAnonCredsRegistry.prototype, 'validateProof')
      validateProofSpy.mockResolvedValueOnce(false)

      const schemaContent = { attrNames: ['a'], name: 'N', version: 'V' }
      const contentString = canonicalize(schemaContent)
      const digestBuffer = createHash('sha256').update(contentString).digest()
      const multibaseHash = encodeMultihash(digestBuffer)
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
      // Expect the 'invalid' error due to validateProof returning false
      expect(result).toEqual({
        schemaId,
        resolutionMetadata: {
          error: 'invalid',
          message: expect.stringContaining('Resolved resource proof is invalid'),
        },
        schemaMetadata: {},
      })
      // Restore the original method if needed elsewhere
      validateProofSpy.mockRestore()
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
      const digestBuffer = createHash('sha256').update(contentString).digest()
      const multibaseHash = encodeMultihash(digestBuffer)
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

  // Add tests for getCredentialDefinition, getRevocationRegistryDefinition, getRevocationStatusList
  // following a similar pattern, mocking resolveResource and expecting 'Method not implemented.'
  // or specific errors based on input validation.

  // Example for getCredentialDefinition
  describe('getCredentialDefinition', () => {
    it('should return resolutionMetadata with error for invalid prefix (tested via helper)', async () => {
      const credDefId = 'did:web:example.com/resource/credDef123' // Invalid prefix for this registry

      // We expect the helper function to throw before specific logic is hit
      const result = await registry.getCredentialDefinition(agentContext, credDefId)

      // Expect the error thrown by the helper function
      expect(result.resolutionMetadata.error).toBe('invalidDid')
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
      expect(result.resolutionMetadata.error).toBe('notFound')
      expect(result.resolutionMetadata.message).toContain('could not be resolved or is missing data')
    })
  })

  // TODO: Add similar tests for getRevocationRegistryDefinition and getRevocationStatusList

  describe('getRevocationRegistryDefinition', () => {
    it('should correctly resolve and parse a valid RevRegDef resource', async () => {
      const revRegDefId = MockRevRegDefResource.id
      const mockResolverResponse = {
        content: MockRevRegDefResource,
        contentMetadata: MockRevRegDefResource.metadata || {},
        dereferencingMetadata: { contentType: 'application/json' },
      }

      mockResolveResource.mockResolvedValue(mockResolverResponse)

      // We need to mock validateProof to return true for this test
      const validateProofSpy = jest.spyOn(WebVhAnonCredsRegistry.prototype, 'validateProof')
      validateProofSpy.mockResolvedValue(true)

      const result = await registry.getRevocationRegistryDefinition(agentContext, revRegDefId)

      // Debug output
      // console.log('RevRegDef Test Result:', JSON.stringify(result, null, 2))

      expect(mockResolveResource).toHaveBeenCalledWith(agentContext, revRegDefId)
      expect(validateProofSpy).toHaveBeenCalled()
      expect(result.resolutionMetadata.error).toBeUndefined()
      expect(result.revocationRegistryDefinition).toBeDefined()
      expect(result.revocationRegistryDefinition?.issuerId).toBe(MockRevRegDefResource.content.issuerId)
      expect(result.revocationRegistryDefinition?.revocDefType).toBe(MockRevRegDefResource.content.revocDefType)
      expect(result.revocationRegistryDefinition?.credDefId).toBe(MockRevRegDefResource.content.credDefId)
      expect(result.revocationRegistryDefinition?.tag).toBe(MockRevRegDefResource.content.tag)
      expect(result.revocationRegistryDefinition?.value).toEqual(MockRevRegDefResource.content.value)
      expect(result.revocationRegistryDefinitionMetadata).toEqual(MockRevRegDefResource.metadata)
      expect(result.resolutionMetadata).toEqual(mockResolverResponse.dereferencingMetadata)

      validateProofSpy.mockRestore()
    })

    // Add more tests for error cases (invalid ID, not found, hash mismatch, invalid content etc.)
    // similar to the getSchema tests
  })

  describe('Resource Transformation', () => {
    it('should correctly transform a schema resource', () => {
      const resource = JsonTransformer.fromJSON(MockSchemaResource, WebVhResource)

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
      const resource = JsonTransformer.fromJSON(MockCredDefResource, WebVhResource)

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
})
