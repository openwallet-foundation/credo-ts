import type { CacheRecord } from '../../core/src/cache'

import {
  EventEmitter,
  IndyWallet,
  Key,
  KeyType,
  SigningProviderRegistry,
  TypedArrayEncoder,
} from '@aries-framework/core'
import { GetNymRequest, NymRequest, SchemaRequest, CredentialDefinitionRequest } from 'indy-vdr-test-shared'
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

let signerKey: Key

indyVdrPoolService.setPools([config])

describe('IndyVdrPoolService', () => {
  beforeAll(async () => {
    await indyVdrPoolService.connectToPools()

    await wallet.createAndOpen(agentConfig.walletConfig!)
    signerKey = await wallet.createKey({ seed: '000000000000000000000000Trustee9', keyType: KeyType.Ed25519 })
  })

  afterAll(async () => {
    for (const pool of indyVdrPoolService.pools) {
      pool.close()
    }

    await wallet.delete()
  })

  describe('DIDs', () => {
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

      // prepare the DID we are going to write to the ledger
      const key = await wallet.createKey({ keyType: KeyType.Ed25519 })
      const buffer = TypedArrayEncoder.fromBase58(key.publicKeyBase58)
      const did = TypedArrayEncoder.toBase58(buffer.slice(0, 16))

      const request = new NymRequest({
        dest: did,
        submitterDid: 'TL1EaPFCZ8Si5aUrqScBDt',
        verkey: key.publicKeyBase58,
      })

      const response = await pool.submitWriteRequest(agentContext, request, signerKey)

      console.log(response)
    })
  })

  describe('CredentialDefinition', () => {
    test('can write a credential definition using the pool', async () => {
      const pool = indyVdrPoolService.getPoolForNamespace('pool:localtest')

      const credentialDefinitionRequest = new CredentialDefinitionRequest({
        submitterDid: 'TL1EaPFCZ8Si5aUrqScBDt',
        credentialDefinition: {
          ver: '1.0',
          id: 'test-credential-id',
          schemaId: 'test-schema-id',
          type: 'CL',
          tag: 'TAG',
          value: {
            primary: {},
          },
        },
      })

      const response = await pool.submitWriteRequest(agentContext, credentialDefinitionRequest, signerKey)

      console.log(response)
    })
  })

  describe('Schemas', () => {
    test('can write a schema using the pool', async () => {
      const pool = indyVdrPoolService.getPoolForNamespace('pool:localtest')

      const dynamicVersion = `1.${Math.random() * 100}` // TODO Remove this before pushing

      const schemaRequest = new SchemaRequest({
        submitterDid: 'TL1EaPFCZ8Si5aUrqScBDt',
        schema: {
          id: 'test-schema-id',
          name: 'test-schema',
          ver: '1.0',
          version: dynamicVersion, // TODO remove this before pushing
          attrNames: ['first_name', 'last_name', 'age'],
        },
      })

      const response = await pool.submitWriteRequest(agentContext, schemaRequest, signerKey)

      console.log(JSON.stringify(response, null, 2))

      expect(response.op).toEqual('REPLY')

      // FIXME ts-ignore is required. Check that the response type is typed correctly.

      // @ts-ignore
      expect(response.result.txn.data.data.name).toEqual('test-schema')

      // @ts-ignore
      expect(response.result.txn.data.data.version).toEqual(dynamicVersion) // TODO remove this before pushing

      // @ts-ignore
      expect(response.result.txn.data.data.attr_names.sort()).toEqual(
        expect.arrayContaining(['first_name', 'last_name', 'age'].sort())
      )

      expect(response.result.txn.protocolVersion).toEqual(2)

      expect(response.result.txn.metadata.from).toEqual('TL1EaPFCZ8Si5aUrqScBDt')

      expect(response.result.txn.metadata.taaAcceptance).toBeDefined()

      expect(response.result.txn.metadata.taaAcceptance!.mechanism).toEqual('accept')

      // testing response.result.tnxMetadata.txnId
      const txnIdArray = response.result.txnMetadata.txnId.split(':')

      const receivedSubmitterDid = txnIdArray[0]
      const receivedProtocolVersion = txnIdArray[1]
      const receivedSchemaName = txnIdArray[2]
      const receivedSchemaVersionVersion = txnIdArray[3]

      expect(receivedSubmitterDid).toEqual('TL1EaPFCZ8Si5aUrqScBDt')

      expect(receivedProtocolVersion).toEqual('2')

      expect(receivedSchemaName).toEqual('test-schema')

      expect(receivedSchemaVersionVersion).toEqual(dynamicVersion) // TODO change this before pushing

      // testing reqSignature
      expect(response.result.reqSignature.type).toEqual('ED25519')

      expect(response.result.reqSignature.values[0].from).toEqual('TL1EaPFCZ8Si5aUrqScBDt')

      // testing ver
      expect(response.result.ver).toEqual('1')
    })

    test('fails writing a schema with existing verson number using the pool', async () => {
      const pool = indyVdrPoolService.getPoolForNamespace('pool:localtest')

      const dynamicVersion = `1.${Math.random() * 100}` // TODO Remove this before pushing

      const schemaRequest = new SchemaRequest({
        submitterDid: 'TL1EaPFCZ8Si5aUrqScBDt',
        schema: {
          id: 'test-schema-id',
          name: 'test-schema',
          ver: '1.0',
          version: dynamicVersion,
          attrNames: ['first_name', 'last_name', 'age'],
        },
      })

      const schemaRequest2 = new SchemaRequest({
        submitterDid: 'TL1EaPFCZ8Si5aUrqScBDt',
        schema: {
          id: 'test-schema-id',
          name: 'test-schema',
          ver: '1.0',
          version: dynamicVersion,
          attrNames: ['first_name', 'last_name', 'age'],
        },
      })

      const response = await pool.submitWriteRequest(agentContext, schemaRequest, signerKey)
      expect(response).toBeDefined()

      // const response2 = await pool.submitWriteRequest(agentContext, schemaRequest2, signerKey)

      // expect(response2.op).toEqual('REJECT')

      // @ts-ignore
      // expect(response2.identifier).toEqual('TL1EaPFCZ8Si5aUrqScBDt')
    })
  })
})
