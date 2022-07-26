import type { Wallet } from '../../../../../wallet'
import type { IndyPool } from '../../../../ledger'
import type * as Indy from 'indy-sdk'

import { getAgentConfig, getAgentContext, mockFunction, mockProperty } from '../../../../../../tests/helpers'
import { SigningProviderRegistry } from '../../../../../crypto/signing-provider'
import { JsonTransformer } from '../../../../../utils/JsonTransformer'
import { IndyWallet } from '../../../../../wallet/IndyWallet'
import { IndyLedgerService } from '../../../../ledger/services/IndyLedgerService'
import { IndyPoolService } from '../../../../ledger/services/IndyPoolService'
import { DidDocumentRole } from '../../../domain/DidDocumentRole'
import { DidRepository } from '../../../repository/DidRepository'
import { SovDidRegistrar } from '../SovDidRegistrar'

jest.mock('../../../repository/DidRepository')
const DidRepositoryMock = DidRepository as jest.Mock<DidRepository>

jest.mock('../../../../ledger/services/IndyLedgerService')
const IndyLedgerServiceMock = IndyLedgerService as jest.Mock<IndyLedgerService>

jest.mock('../../../../ledger/services/IndyPoolService')
const IndyPoolServiceMock = IndyPoolService as jest.Mock<IndyPoolService>
const indyPoolServiceMock = new IndyPoolServiceMock()
mockProperty(indyPoolServiceMock, 'ledgerWritePool', { config: { id: 'pool1', didIndyNamespace: 'pool1' } } as IndyPool)

const agentConfig = getAgentConfig('SovDidRegistrar')

const createDidMock = jest.fn(async () => ['R1xKJw17sUoXhejEpugMYJ', 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu'])

const wallet = new IndyWallet(agentConfig.agentDependencies, agentConfig.logger, new SigningProviderRegistry([]))
mockProperty(wallet, 'handle', 10)

const agentContext = getAgentContext({
  wallet,
})

const didRepositoryMock = new DidRepositoryMock()
const indyLedgerServiceMock = new IndyLedgerServiceMock()
const sovDidRegistrar = new SovDidRegistrar(didRepositoryMock, indyLedgerServiceMock, indyPoolServiceMock, {
  ...agentConfig.agentDependencies,
  indy: { createAndStoreMyDid: createDidMock } as unknown as typeof Indy,
})

describe('DidRegistrar', () => {
  describe('SovDidRegistrar', () => {
    afterEach(() => {
      jest.clearAllMocks()
    })

    it('should return an error state if an invalid seed is provided', async () => {
      const result = await sovDidRegistrar.create(agentContext, {
        method: 'sov',

        options: {
          submitterDid: 'did:sov:BzCbsNYhMrjHiqZDTUASHg',
          alias: 'Hello',
        },
        secret: {
          seed: 'invalid',
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Invalid seed provided',
        },
      })
    })

    it('should return an error state if the wallet is not an indy wallet', async () => {
      const agentContext = getAgentContext({
        wallet: {} as unknown as Wallet,
      })

      const result = await sovDidRegistrar.create(agentContext, {
        method: 'sov',

        options: {
          submitterDid: 'did:sov:BzCbsNYhMrjHiqZDTUASHg',
          alias: 'Hello',
        },
        secret: {
          seed: '12345678901234567890123456789012',
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'unknownError: Expected wallet to be instance of IndyWallet, found Object',
        },
      })
    })

    it('should return an error state if the submitter did is not qualified with did:sov', async () => {
      const result = await sovDidRegistrar.create(agentContext, {
        method: 'sov',
        options: {
          submitterDid: 'BzCbsNYhMrjHiqZDTUASHg',
          alias: 'Hello',
        },
      })

      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: 'Submitter did must be a valid did:sov did',
        },
      })
    })

    it('should correctly create a did:sov document without services', async () => {
      const seed = '96213c3d7fc8d4d6754c712fd969598e'
      const result = await sovDidRegistrar.create(agentContext, {
        method: 'sov',
        options: {
          alias: 'Hello',
          submitterDid: 'did:sov:BzCbsNYhMrjHiqZDTUASHg',
          role: 'STEWARD',
        },
        secret: {
          seed,
        },
      })

      expect(indyLedgerServiceMock.registerPublicDid).toHaveBeenCalledWith(
        agentContext,
        // Unqualified submitter did
        'BzCbsNYhMrjHiqZDTUASHg',
        // Unqualified created indy did
        'R1xKJw17sUoXhejEpugMYJ',
        // Verkey
        'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
        // Alias
        'Hello',
        // Role
        'STEWARD'
      )
      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {
          qualifiedIndyDid: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
        },
        didRegistrationMetadata: {
          indyNamespace: 'pool1',
        },
        didState: {
          state: 'finished',
          did: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
          didDocument: {
            '@context': [
              'https://w3id.org/did/v1',
              'https://w3id.org/security/suites/ed25519-2018/v1',
              'https://w3id.org/security/suites/x25519-2019/v1',
            ],
            id: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
            verificationMethod: [
              {
                id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#key-1',
                type: 'Ed25519VerificationKey2018',
                controller: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
                publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
              },
              {
                id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1',
                type: 'X25519KeyAgreementKey2019',
                controller: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
                publicKeyBase58: 'Fbv17ZbnUSbafsiUBJbdGeC62M8v8GEscVMMcE59mRPt',
              },
            ],
            authentication: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-1'],
            assertionMethod: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-1'],
            keyAgreement: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1'],
          },
          secret: {
            seed,
          },
        },
      })
    })

    it('should correctly create a did:sov document with services', async () => {
      const seed = '96213c3d7fc8d4d6754c712fd969598e'
      const result = await sovDidRegistrar.create(agentContext, {
        method: 'sov',
        options: {
          alias: 'Hello',
          submitterDid: 'did:sov:BzCbsNYhMrjHiqZDTUASHg',
          role: 'STEWARD',
          endpoints: {
            endpoint: 'https://example.com/endpoint',
            routingKeys: ['key-1'],
            types: ['DIDComm', 'did-communication', 'endpoint'],
          },
        },
        secret: {
          seed,
        },
      })

      expect(indyLedgerServiceMock.registerPublicDid).toHaveBeenCalledWith(
        agentContext,
        // Unqualified submitter did
        'BzCbsNYhMrjHiqZDTUASHg',
        // Unqualified created indy did
        'R1xKJw17sUoXhejEpugMYJ',
        // Verkey
        'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
        // Alias
        'Hello',
        // Role
        'STEWARD'
      )
      expect(JsonTransformer.toJSON(result)).toMatchObject({
        didDocumentMetadata: {
          qualifiedIndyDid: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
        },
        didRegistrationMetadata: {
          indyNamespace: 'pool1',
        },
        didState: {
          state: 'finished',
          did: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
          didDocument: {
            '@context': [
              'https://w3id.org/did/v1',
              'https://w3id.org/security/suites/ed25519-2018/v1',
              'https://w3id.org/security/suites/x25519-2019/v1',
              'https://didcomm.org/messaging/contexts/v2',
            ],
            id: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
            verificationMethod: [
              {
                id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#key-1',
                type: 'Ed25519VerificationKey2018',
                controller: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
                publicKeyBase58: 'E6D1m3eERqCueX4ZgMCY14B4NceAr6XP2HyVqt55gDhu',
              },
              {
                id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1',
                type: 'X25519KeyAgreementKey2019',
                controller: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
                publicKeyBase58: 'Fbv17ZbnUSbafsiUBJbdGeC62M8v8GEscVMMcE59mRPt',
              },
            ],
            service: [
              {
                id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#endpoint',
                serviceEndpoint: 'https://example.com/endpoint',
                type: 'endpoint',
              },
              {
                id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#did-communication',
                serviceEndpoint: 'https://example.com/endpoint',
                type: 'did-communication',
                priority: 0,
                recipientKeys: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1'],
                routingKeys: ['key-1'],
                accept: ['didcomm/aip2;env=rfc19'],
              },
              {
                id: 'did:sov:R1xKJw17sUoXhejEpugMYJ#didcomm-1',
                serviceEndpoint: 'https://example.com/endpoint',
                type: 'DIDComm',
                routingKeys: ['key-1'],
                accept: ['didcomm/v2'],
              },
            ],
            authentication: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-1'],
            assertionMethod: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-1'],
            keyAgreement: ['did:sov:R1xKJw17sUoXhejEpugMYJ#key-agreement-1'],
          },
          secret: {
            seed,
          },
        },
      })
    })

    it('should store the did document', async () => {
      const seed = '96213c3d7fc8d4d6754c712fd969598e'
      await sovDidRegistrar.create(agentContext, {
        method: 'sov',
        options: {
          alias: 'Hello',
          submitterDid: 'did:sov:BzCbsNYhMrjHiqZDTUASHg',
          role: 'STEWARD',
          endpoints: {
            endpoint: 'https://example.com/endpoint',
            routingKeys: ['key-1'],
            types: ['DIDComm', 'did-communication', 'endpoint'],
          },
        },
        secret: {
          seed,
        },
      })

      expect(didRepositoryMock.save).toHaveBeenCalledTimes(1)
      const [, didRecord] = mockFunction(didRepositoryMock.save).mock.calls[0]

      expect(didRecord).toMatchObject({
        id: 'did:sov:R1xKJw17sUoXhejEpugMYJ',
        role: DidDocumentRole.Created,
        _tags: {
          recipientKeyFingerprints: ['z6LSrH6AdsQeZuKKmG6Ehx7abEQZsVg2psR2VU536gigUoAe'],
          qualifiedIndyDid: 'did:indy:pool1:R1xKJw17sUoXhejEpugMYJ',
        },
        didDocument: undefined,
      })
    })

    it('should return an error state when calling update', async () => {
      const result = await sovDidRegistrar.update()

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `notImplemented: updating did:sov not implemented yet`,
        },
      })
    })

    it('should return an error state when calling deactivate', async () => {
      const result = await sovDidRegistrar.deactivate()

      expect(result).toEqual({
        didDocumentMetadata: {},
        didRegistrationMetadata: {},
        didState: {
          state: 'failed',
          reason: `notImplemented: deactivating did:sov not implemented yet`,
        },
      })
    })
  })
})
