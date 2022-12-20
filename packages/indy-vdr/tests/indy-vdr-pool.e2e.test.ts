import type { CacheRecord } from '../../core/src/cache'

import {
  EventEmitter,
  IndyWallet,
  Key,
  KeyType,
  KeyType,
  SigningProviderRegistry,
  TypedArrayEncoder,
} from '@aries-framework/core'
import { GetNymRequest, NymRequest } from 'indy-vdr-test-shared'
import { Subject } from 'rxjs'

import { CacheRepository } from '../../core/src/cache'
import { IndyStorageService } from '../../core/src/storage/IndyStorageService'
import { agentDependencies, genesisTransactions, getAgentConfig, getAgentContext } from '../../core/tests/helpers'
import testLogger from '../../core/tests/logger'
import { IndyVdrPool } from '../src/pool'
import { IndyVdrPoolService } from '../src/pool/IndyVdrPoolService'

const storageService = new IndyStorageService<CacheRecord>(agentDependencies)
const eventEmitter = new EventEmitter(agentDependencies, new Subject())
const cacheRepository = new CacheRepository(storageService, eventEmitter)
const indyVdrPoolService = new IndyVdrPoolService(cacheRepository, testLogger)
const wallet = new IndyWallet(agentDependencies, testLogger, new SigningProviderRegistry([]))
const agentConfig = getAgentConfig('IndyVdrPoolService')
const agentContext = getAgentContext({ wallet, agentConfig })

const config = {
  isProduction: false,
  genesisTransactions,
  indyNamespace: `pool:localtest`,
  transactionAuthorAgreement: { version: '1', acceptanceMechanism: 'accept' },
} as const

indyVdrPoolService.setPools([config])

describe('IndyVdrPoolService', () => {
  beforeAll(async () => {
    await indyVdrPoolService.connectToPools()

    await wallet.createAndOpen(agentConfig.walletConfig!)
  })

  afterAll(async () => {
    for (const pool of indyVdrPoolService.pools) {
      pool.close()
    }

    await wallet.delete()
  })

  test('can get a pool based on the namespace', async () => {
    const pool = indyVdrPoolService.getPoolForNamespace('pool:localtest')
    expect(pool).toBeInstanceOf(IndyVdrPool)
    expect(pool.config).toEqual(config)
  })

  test('can resolve a did using the pool', async () => {
    const pool = indyVdrPoolService.getPoolForNamespace('pool:localtest')

    const request = new GetNymRequest({
      dest: 'TL1EaPFCZ8Si5aUrqScBDt',
    })

    const response = await pool.submitReadRequest(request)

    expect(response).toMatchObject({
      op: 'REPLY',
      result: {
        dest: 'TL1EaPFCZ8Si5aUrqScBDt',
        type: '105',
        data: '{"dest":"TL1EaPFCZ8Si5aUrqScBDt","identifier":"V4SGRU86Z58d6TV7PBUe6f","role":"0","seqNo":11,"txnTime":1671530269,"verkey":"~43X4NhAFqREffK7eWdKgFH"}',
        identifier: 'LibindyDid111111111111',
        reqId: expect.any(Number),
        seqNo: expect.any(Number),
        txnTime: expect.any(Number),
        state_proof: expect.any(Object),
      },
    })
  })

  test('can write a did using the pool', async () => {
    const pool = indyVdrPoolService.getPoolForNamespace('pool:localtest')

    const key = await wallet.createKey({ keyType: KeyType.Ed25519 })

    const buffer = TypedArrayEncoder.fromBase58(key.publicKeyBase58)
    const did = TypedArrayEncoder.toBase58(buffer.slice(0, 16))
    const signerKey = Key.fromPublicKeyBase58('FMGcFuU3QwAQLywxvmEnSorQT3NwU9wgDMMTaDFtvswm', KeyType.Ed25519)

    const request = new NymRequest({
      dest: did,
      submitterDid: 'TL1EaPFCZ8Si5aUrqScBDt',
      verkey: key.publicKeyBase58,
    })

    const response = await pool.submitWriteRequest(agentContext, request, signerKey)

    console.log(response)
  })
})
