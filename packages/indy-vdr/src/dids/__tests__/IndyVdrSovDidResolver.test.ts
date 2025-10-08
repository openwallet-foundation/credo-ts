import { JsonTransformer } from '@credo-ts/core'

import { parseDid } from '../../../../core/src/modules/dids/domain/parse'
import { getAgentConfig, getAgentContext, mockProperty } from '../../../../core/tests/helpers'
import { IndyVdrPool } from '../../pool/IndyVdrPool'
import { IndyVdrPoolService } from '../../pool/IndyVdrPoolService'
import { IndyVdrSovDidResolver } from '../IndyVdrSovDidResolver'

import didSovR1xKJw17sUoXhejEpugMYJFixture from './__fixtures__/didSovR1xKJw17sUoXhejEpugMYJ.json'
import didSovWJz9mHyW9BZksioQnRsrAoFixture from './__fixtures__/didSovWJz9mHyW9BZksioQnRsrAo.json'

jest.mock('../../pool/IndyVdrPool')
const IndyVdrPoolMock = IndyVdrPool as jest.Mock<IndyVdrPool>
const poolMock = new IndyVdrPoolMock()
mockProperty(poolMock, 'indyNamespace', 'local')

const agentConfig = getAgentConfig('IndyVdrSovDidResolver')

const agentContext = getAgentContext({
  agentConfig,
  registerInstances: [[IndyVdrPoolService, { getPoolForDid: vi.fn().mockReturnValue({ pool: poolMock }) }]],
})

const resolver = new IndyVdrSovDidResolver()

describe('DidResolver', () => {
  describe('IndyVdrSovDidResolver', () => {
    it('should correctly resolve a did:sov document', async () => {
      const did = 'did:sov:R1xKJw17sUoXhejEpugMYJ'

      const nymResponse = {
        result: {
          data: JSON.stringify({
            did: 'R1xKJw17sUoXhejEpugMYJ',
            verkey: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
            role: 'ENDORSER',
          }),
        },
      }

      const attribResponse = {
        result: {
          data: JSON.stringify({
            endpoint: {
              endpoint: 'https://ssi.com',
              profile: 'https://profile.com',
              hub: 'https://hub.com',
            },
          }),
        },
      }

      jest.spyOn(poolMock, 'submitRequest').mockResolvedValueOnce(nymResponse)
      jest.spyOn(poolMock, 'submitRequest').mockResolvedValueOnce(attribResponse)

      const result = await resolver.resolve(agentContext, did, parseDid(did))

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocument: didSovR1xKJw17sUoXhejEpugMYJFixture,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: 'application/did+ld+json',
        },
      })
    })

    it('should resolve a did:sov document with routingKeys and types entries in the attrib', async () => {
      const did = 'did:sov:WJz9mHyW9BZksioQnRsrAo'

      const nymResponse = {
        result: {
          data: JSON.stringify({
            did: 'WJz9mHyW9BZksioQnRsrAo',
            verkey: 'GyYtYWU1vjwd5PFJM4VSX5aUiSV3TyZMuLBJBTQvfdF8',
            role: 'ENDORSER',
          }),
        },
      }

      const attribResponse = {
        result: {
          data: JSON.stringify({
            endpoint: {
              endpoint: 'https://agent.com',
              types: ['endpoint', 'did-communication', 'DIDComm'],
              routingKeys: ['routingKey1', 'routingKey2'],
            },
          }),
        },
      }

      jest.spyOn(poolMock, 'submitRequest').mockResolvedValueOnce(nymResponse)
      jest.spyOn(poolMock, 'submitRequest').mockResolvedValueOnce(attribResponse)

      const result = await resolver.resolve(agentContext, did, parseDid(did))

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocument: didSovWJz9mHyW9BZksioQnRsrAoFixture,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          contentType: 'application/did+ld+json',
        },
      })
    })

    it('should return did resolution metadata with error if the indy ledger service throws an error', async () => {
      const did = 'did:sov:R1xKJw17sUoXhejEpugMYJ'

      jest.spyOn(poolMock, 'submitRequest').mockRejectedValue(new Error('Error submitting read request'))

      const result = await resolver.resolve(agentContext, did, parseDid(did))

      expect(result).toMatchObject({
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did 'did:sov:R1xKJw17sUoXhejEpugMYJ': Error: Error submitting read request`,
        },
      })
    })
  })
})
