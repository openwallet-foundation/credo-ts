import type { Key } from '@aries-framework/core'

import { AskarStorageService, AskarWallet } from '@aries-framework/askar'
import {
  InjectionSymbols,
  CacheModuleConfig,
  InMemoryLruCache,
  JsonTransformer,
  KeyType,
  SigningProviderRegistry,
  TypedArrayEncoder,
} from '@aries-framework/core'
import { Subject } from 'rxjs'

import { agentDependencies, getAgentConfig, getAgentContext } from '../../core/tests/helpers'
import testLogger from '../../core/tests/logger'
import { IndyVdrIndyDidRegistrar } from '../src/dids/IndyVdrIndyDidRegistrar'
import { IndyVdrIndyDidResolver } from '../src/dids/IndyVdrIndyDidResolver'
import { IndyVdrPoolService } from '../src/pool/IndyVdrPoolService'

import '@hyperledger/aries-askar-nodejs'
import { indyVdrModuleConfig } from './helpers'

const logger = testLogger
const wallet = new AskarWallet(logger, new agentDependencies.FileSystem(), new SigningProviderRegistry([]))

const agentConfig = getAgentConfig('IndyVdrIndyDidRegistrar E2E', { logger })

const cache = new InMemoryLruCache({ limit: 200 })
const indyVdrIndyDidResolver = new IndyVdrIndyDidResolver()
const indyVdrIndyDidRegistrar = new IndyVdrIndyDidRegistrar()

let signerKey: Key

const agentContext = getAgentContext({
  wallet,
  agentConfig,
  registerInstances: [
    [InjectionSymbols.Stop$, new Subject<boolean>()],
    [InjectionSymbols.AgentDependencies, agentDependencies],
    [InjectionSymbols.StorageService, new AskarStorageService()],
    [IndyVdrPoolService, new IndyVdrPoolService(logger, indyVdrModuleConfig)],
    [CacheModuleConfig, new CacheModuleConfig({ cache })],
  ],
})

const indyVdrPoolService = agentContext.dependencyManager.resolve(IndyVdrPoolService)

describe('Indy VDR registrar E2E', () => {
  beforeAll(async () => {
    await indyVdrPoolService.connectToPools()

    if (agentConfig.walletConfig) {
      await wallet.createAndOpen(agentConfig.walletConfig)
    }

    signerKey = await wallet.createKey({
      secretKey: TypedArrayEncoder.fromString('000000000000000000000000Trustee9'),
      keyType: KeyType.Ed25519,
    })
  })

  afterAll(async () => {
    for (const pool of indyVdrPoolService.pools) {
      pool.close()
    }

    await wallet.delete()
  })

  test('can register a did:indy without endpoints', async () => {
    const result = await indyVdrIndyDidRegistrar.create(agentContext, {
      method: 'indy',
      options: {
        submitterDid: 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt',
        submitterVerkey: signerKey.publicKeyBase58,
      },
    })

    const did = result.didState.did

    if (!did) {
      throw Error('did not defined')
    }

    const didResult = await indyVdrIndyDidResolver.resolve(agentContext, did)
    expect(JsonTransformer.toJSON(didResult)).toMatchObject({
      didDocument: {
        '@context': ['https://w3id.org/did/v1'],
        id: did,
        alsoKnownAs: undefined,
        controller: undefined,
        verificationMethod: [
          {
            type: 'Ed25519VerificationKey2018',
            controller: did,
            id: `${did}#verkey`,
            publicKeyBase58: expect.any(String),
          },
        ],
        capabilityDelegation: undefined,
        capabilityInvocation: undefined,
        authentication: [`${did}#verkey`],
        service: undefined,
      },
      didDocumentMetadata: {},
      didResolutionMetadata: {
        contentType: 'application/did+ld+json',
      },
    })
  })
})
