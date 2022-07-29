import type { IndyEndpointAttrib } from '../../../../ledger/services'
import type { GetNymResponse } from 'indy-sdk'

import { mockFunction } from '../../../../../../tests/helpers'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { IndyLedgerService } from '../../../../ledger/services'
import didSovR1xKJw17sUoXhejEpugMYJFixture from '../../../__tests__/__fixtures__/didSovR1xKJw17sUoXhejEpugMYJ.json'
import didSovWJz9mHyW9BZksioQnRsrAoFixture from '../../../__tests__/__fixtures__/didSovWJz9mHyW9BZksioQnRsrAo.json'
import { parseDid } from '../../../domain/parse'
import { SovDidResolver } from '../SovDidResolver'

jest.mock('../../../../ledger/services/IndyLedgerService')
const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>

describe('DidResolver', () => {
  describe('SovDidResolver', () => {
    let ledgerService: IndyLedgerService
    let sovDidResolver: SovDidResolver

    beforeEach(() => {
      ledgerService = new IndyLedgerServiceMock()
      sovDidResolver = new SovDidResolver(ledgerService)
    })

    it('should correctly resolve a did:sov document', async () => {
      const did = 'did:sov:R1xKJw17sUoXhejEpugMYJ'

      const nymResponse: GetNymResponse = {
        did: 'R1xKJw17sUoXhejEpugMYJ',
        verkey: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
        role: 'ENDORSER',
      }

      const endpoints: IndyEndpointAttrib = {
        endpoint: 'https://ssi.com',
        profile: 'https://profile.com',
        hub: 'https://hub.com',
      }

      mockFunction(ledgerService.getPublicDid).mockResolvedValue(nymResponse)
      mockFunction(ledgerService.getEndpointsForDid).mockResolvedValue(endpoints)

      const result = await sovDidResolver.resolve(did, parseDid(did))

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

      const nymResponse: GetNymResponse = {
        did: 'WJz9mHyW9BZksioQnRsrAo',
        verkey: 'GyYtYWU1vjwd5PFJM4VSX5aUiSV3TyZMuLBJBTQvfdF8',
        role: 'ENDORSER',
      }

      const endpoints: IndyEndpointAttrib = {
        endpoint: 'https://agent.com',
        types: ['endpoint', 'did-communication', 'DIDComm'],
        routingKeys: ['routingKey1', 'routingKey2'],
      }

      mockFunction(ledgerService.getPublicDid).mockReturnValue(Promise.resolve(nymResponse))
      mockFunction(ledgerService.getEndpointsForDid).mockReturnValue(Promise.resolve(endpoints))

      const result = await sovDidResolver.resolve(did, parseDid(did))

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

      mockFunction(ledgerService.getPublicDid).mockRejectedValue(new Error('Error retrieving did'))

      const result = await sovDidResolver.resolve(did, parseDid(did))

      expect(result).toMatchObject({
        didDocument: null,
        didDocumentMetadata: {},
        didResolutionMetadata: {
          error: 'notFound',
          message: `resolver_error: Unable to resolve did 'did:sov:R1xKJw17sUoXhejEpugMYJ': Error: Error retrieving did`,
        },
      })
    })
  })
})
