import { Agent, DidsModule, Key, KeyType, TypedArrayEncoder } from '@aries-framework/core'
import { RevocationRegistryDefinitionRequest, RevocationRegistryEntryRequest } from '@hyperledger/indy-vdr-shared'

import {
  agentDependencies,
  getAgentConfig,
  importExistingIndyDidFromPrivateKey,
  publicDidSeed,
} from '../../core/tests/helpers'
import { IndySdkModule } from '../../indy-sdk/src'
import { indySdk } from '../../indy-sdk/tests/setupIndySdkModule'
import { IndyVdrIndyDidResolver, IndyVdrModule, IndyVdrSovDidResolver } from '../src'
import { IndyVdrAnonCredsRegistry } from '../src/anoncreds/IndyVdrAnonCredsRegistry'
import { IndyVdrPoolService } from '../src/pool'

import { credentialDefinitionValue } from './__fixtures__/anoncreds'
import { indyVdrModuleConfig } from './helpers'

const agentConfig = getAgentConfig('IndyVdrAnonCredsRegistry')

const indyVdrAnonCredsRegistry = new IndyVdrAnonCredsRegistry()

const agent = new Agent({
  config: agentConfig,
  dependencies: agentDependencies,
  modules: {
    indyVdr: new IndyVdrModule({
      networks: indyVdrModuleConfig.networks,
    }),
    indySdk: new IndySdkModule({
      indySdk,
    }),
    dids: new DidsModule({
      resolvers: [new IndyVdrSovDidResolver(), new IndyVdrIndyDidResolver()],
    }),
  },
})

const indyVdrPoolService = agent.dependencyManager.resolve(IndyVdrPoolService)
const pool = indyVdrPoolService.getPoolForNamespace('pool:localtest')

describe('IndyVdrAnonCredsRegistry', () => {
  beforeAll(async () => {
    await agent.initialize()

    await importExistingIndyDidFromPrivateKey(agent, TypedArrayEncoder.fromString(publicDidSeed))
  })

  afterAll(async () => {
    for (const pool of indyVdrPoolService.pools) {
      pool.close()
    }

    await agent.shutdown()
    await agent.wallet.delete()
  })

  // One test as the credential definition depends on the schema
  test('register and resolve a schema and credential definition', async () => {
    const dynamicVersion = `1.${Math.random() * 100}`

    const legacyIssuerId = 'TL1EaPFCZ8Si5aUrqScBDt'
    const signingKey = Key.fromPublicKeyBase58('FMGcFuU3QwAQLywxvmEnSorQT3NwU9wgDMMTaDFtvswm', KeyType.Ed25519)
    const didIndyIssuerId = 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt'

    const legacySchemaId = `TL1EaPFCZ8Si5aUrqScBDt:2:test:${dynamicVersion}`
    const didIndySchemaId = `did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/SCHEMA/test/${dynamicVersion}`

    const schemaResult = await indyVdrAnonCredsRegistry.registerSchema(agent.context, {
      options: {},
      schema: {
        attrNames: ['age'],
        issuerId: didIndyIssuerId,
        name: 'test',
        version: dynamicVersion,
      },
    })

    expect(schemaResult).toMatchObject({
      schemaState: {
        state: 'finished',
        schema: {
          attrNames: ['age'],
          issuerId: didIndyIssuerId,
          name: 'test',
          version: dynamicVersion,
        },
        schemaId: didIndySchemaId,
      },
      registrationMetadata: {},
      schemaMetadata: {
        indyLedgerSeqNo: expect.any(Number),
      },
    })

    // Wait some time before resolving credential definition object
    await new Promise((res) => setTimeout(res, 1000))

    const legacySchema = await indyVdrAnonCredsRegistry.getSchema(agent.context, legacySchemaId)
    expect(legacySchema).toMatchObject({
      schema: {
        attrNames: ['age'],
        name: 'test',
        version: dynamicVersion,
        issuerId: legacyIssuerId,
      },
      schemaId: legacySchemaId,
      resolutionMetadata: {},
      schemaMetadata: {
        didIndyNamespace: 'pool:localtest',
        indyLedgerSeqNo: expect.any(Number),
      },
    })

    // Resolve using did indy schema id
    const didIndySchema = await indyVdrAnonCredsRegistry.getSchema(agent.context, didIndySchemaId)
    expect(didIndySchema).toMatchObject({
      schema: {
        attrNames: ['age'],
        name: 'test',
        version: dynamicVersion,
        issuerId: didIndyIssuerId,
      },
      schemaId: didIndySchemaId,
      resolutionMetadata: {},
      schemaMetadata: {
        didIndyNamespace: 'pool:localtest',
        indyLedgerSeqNo: expect.any(Number),
      },
    })

    const legacyCredentialDefinitionId = `TL1EaPFCZ8Si5aUrqScBDt:3:CL:${schemaResult.schemaMetadata.indyLedgerSeqNo}:TAG`
    const didIndyCredentialDefinitionId = `did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/CLAIM_DEF/${schemaResult.schemaMetadata.indyLedgerSeqNo}/TAG`
    const credentialDefinitionResult = await indyVdrAnonCredsRegistry.registerCredentialDefinition(agent.context, {
      credentialDefinition: {
        issuerId: didIndyIssuerId,
        tag: 'TAG',
        schemaId: didIndySchemaId,
        type: 'CL',
        value: credentialDefinitionValue,
      },
      options: {},
    })

    expect(credentialDefinitionResult).toMatchObject({
      credentialDefinitionMetadata: {},
      credentialDefinitionState: {
        credentialDefinition: {
          issuerId: didIndyIssuerId,
          tag: 'TAG',
          schemaId: didIndySchemaId,
          type: 'CL',
          value: credentialDefinitionValue,
        },
        credentialDefinitionId: didIndyCredentialDefinitionId,
        state: 'finished',
      },
      registrationMetadata: {},
    })

    // Wait some time before resolving credential definition object
    await new Promise((res) => setTimeout(res, 1000))

    const legacyCredentialDefinition = await indyVdrAnonCredsRegistry.getCredentialDefinition(
      agent.context,
      legacyCredentialDefinitionId
    )

    expect(legacyCredentialDefinition).toMatchObject({
      credentialDefinitionId: legacyCredentialDefinitionId,
      credentialDefinition: {
        issuerId: legacyIssuerId,
        schemaId: legacySchemaId,
        tag: 'TAG',
        type: 'CL',
        value: credentialDefinitionValue,
      },
      credentialDefinitionMetadata: {
        didIndyNamespace: 'pool:localtest',
      },
      resolutionMetadata: {},
    })

    // resolve using did indy credential definition id
    const didIndyCredentialDefinition = await indyVdrAnonCredsRegistry.getCredentialDefinition(
      agent.context,
      didIndyCredentialDefinitionId
    )

    expect(didIndyCredentialDefinition).toMatchObject({
      credentialDefinitionId: didIndyCredentialDefinitionId,
      credentialDefinition: {
        issuerId: didIndyIssuerId,
        schemaId: didIndySchemaId,
        tag: 'TAG',
        type: 'CL',
        value: credentialDefinitionValue,
      },
      credentialDefinitionMetadata: {
        didIndyNamespace: 'pool:localtest',
      },
      resolutionMetadata: {},
    })

    // We don't support creating a revocation registry using AFJ yet, so we directly use indy-vdr to create the revocation registry
    const legacyRevocationRegistryId = `TL1EaPFCZ8Si5aUrqScBDt:4:TL1EaPFCZ8Si5aUrqScBDt:3:CL:${schemaResult.schemaMetadata.indyLedgerSeqNo}:TAG:CL_ACCUM:tag`
    const didIndyRevocationRegistryId = `did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/REV_REG_DEF/${schemaResult.schemaMetadata.indyLedgerSeqNo}/TAG/tag`
    const revocationRegistryRequest = new RevocationRegistryDefinitionRequest({
      submitterDid: 'TL1EaPFCZ8Si5aUrqScBDt',
      revocationRegistryDefinitionV1: {
        credDefId: legacyCredentialDefinitionId,
        id: legacyRevocationRegistryId,
        revocDefType: 'CL_ACCUM',
        tag: 'tag',
        value: {
          issuanceType: 'ISSUANCE_BY_DEFAULT',
          maxCredNum: 100,
          publicKeys: {
            accumKey: {
              z: '1 1812B206EB395D3AEBD4BBF53EBB0FFC3371D8BD6175316AB32C1C5F65452051 1 22A079D49C5351EFDC1410C81A1F6D8B2E3B79CFF20A30690C118FE2050F72CB 1 0FFC28B923A4654E261DB4CB5B9BABEFCB4DB189B20F52412B0CC9CCCBB8A3B2 1 1EE967C43EF1A3F487061D21B07076A26C126AAF7712E7B5CF5A53688DDD5CC0 1 009ED4D65879CA81DA8227D34CEA3B759B4627E1E2FFB273E9645CD4F3B10F19 1 1CF070212E1E213AEB472F56EDFC9D48009796C77B2D8CC16F2836E37B8715C2 1 04954F0B7B468781BAAE3291DD0E6FFA7F1AF66CAA4094D37B24363CC34606FB 1 115367CB755E9DB18781B3825CB1AEE2C334558B2C038E13DF57BB57CE1CF847 1 110D37EC05862EE2757A7DF39E814876FC97376FF8105D2D29619CB575537BDE 1 13C559A9563FCE083B3B39AE7E8FCA4099BEF3A4C8C6672E543D521F9DA88F96 1 137D87CC22ACC1B6B8C20EABE59F6ED456A58FE4CBEEFDFC4FA9B87E3EF32D17 1 00A2A9711737AAF0404F35AE502887AC6172B2B57D236BD4A40B45F659BFC696',
            },
          },
          tailsHash: 'HLKresYcDSZYSKogq8wive4zyXNY84669MygftLFBG1i',
          tailsLocation:
            '/var/folders/l3/xy8jzyvj4p5_d9g1123rt4bw0000gn/T/HLKresYcDSZYSKogq8wive4zyXNY84669MygftLFBG1i',
        },
        ver: '1.0',
      },
    })

    // After this call, the revocation registry should now be resolvable
    await pool.submitWriteRequest(agent.context, revocationRegistryRequest, signingKey)

    // Also create a revocation registry entry
    const revocationEntryRequest = new RevocationRegistryEntryRequest({
      revocationRegistryDefinitionId: legacyRevocationRegistryId,
      revocationRegistryDefinitionType: 'CL_ACCUM',
      revocationRegistryEntry: {
        ver: '1.0',
        value: {
          accum: '1',
        },
      },
      submitterDid: legacyIssuerId,
    })

    // After this call we can query the revocation registry entries (using timestamp now)
    const entryResponse = await pool.submitWriteRequest(agent.context, revocationEntryRequest, signingKey)

    const legacyRevocationRegistryDefinition = await indyVdrAnonCredsRegistry.getRevocationRegistryDefinition(
      agent.context,
      legacyRevocationRegistryId
    )
    expect(legacyRevocationRegistryDefinition).toMatchObject({
      revocationRegistryDefinitionId: legacyRevocationRegistryId,
      revocationRegistryDefinition: {
        issuerId: legacyIssuerId,
        revocDefType: 'CL_ACCUM',
        value: {
          maxCredNum: 100,
          tailsHash: 'HLKresYcDSZYSKogq8wive4zyXNY84669MygftLFBG1i',
          tailsLocation:
            '/var/folders/l3/xy8jzyvj4p5_d9g1123rt4bw0000gn/T/HLKresYcDSZYSKogq8wive4zyXNY84669MygftLFBG1i',
          publicKeys: {
            accumKey: {
              z: '1 1812B206EB395D3AEBD4BBF53EBB0FFC3371D8BD6175316AB32C1C5F65452051 1 22A079D49C5351EFDC1410C81A1F6D8B2E3B79CFF20A30690C118FE2050F72CB 1 0FFC28B923A4654E261DB4CB5B9BABEFCB4DB189B20F52412B0CC9CCCBB8A3B2 1 1EE967C43EF1A3F487061D21B07076A26C126AAF7712E7B5CF5A53688DDD5CC0 1 009ED4D65879CA81DA8227D34CEA3B759B4627E1E2FFB273E9645CD4F3B10F19 1 1CF070212E1E213AEB472F56EDFC9D48009796C77B2D8CC16F2836E37B8715C2 1 04954F0B7B468781BAAE3291DD0E6FFA7F1AF66CAA4094D37B24363CC34606FB 1 115367CB755E9DB18781B3825CB1AEE2C334558B2C038E13DF57BB57CE1CF847 1 110D37EC05862EE2757A7DF39E814876FC97376FF8105D2D29619CB575537BDE 1 13C559A9563FCE083B3B39AE7E8FCA4099BEF3A4C8C6672E543D521F9DA88F96 1 137D87CC22ACC1B6B8C20EABE59F6ED456A58FE4CBEEFDFC4FA9B87E3EF32D17 1 00A2A9711737AAF0404F35AE502887AC6172B2B57D236BD4A40B45F659BFC696',
            },
          },
        },
        tag: 'tag',
        credDefId: legacyCredentialDefinitionId,
      },
      revocationRegistryDefinitionMetadata: {
        issuanceType: 'ISSUANCE_BY_DEFAULT',
        didIndyNamespace: 'pool:localtest',
      },
      resolutionMetadata: {},
    })

    const didIndyRevocationRegistryDefinition = await indyVdrAnonCredsRegistry.getRevocationRegistryDefinition(
      agent.context,
      didIndyRevocationRegistryId
    )
    expect(didIndyRevocationRegistryDefinition).toMatchObject({
      revocationRegistryDefinitionId: didIndyRevocationRegistryId,
      revocationRegistryDefinition: {
        issuerId: didIndyIssuerId,
        revocDefType: 'CL_ACCUM',
        value: {
          maxCredNum: 100,
          tailsHash: 'HLKresYcDSZYSKogq8wive4zyXNY84669MygftLFBG1i',
          tailsLocation:
            '/var/folders/l3/xy8jzyvj4p5_d9g1123rt4bw0000gn/T/HLKresYcDSZYSKogq8wive4zyXNY84669MygftLFBG1i',
          publicKeys: {
            accumKey: {
              z: '1 1812B206EB395D3AEBD4BBF53EBB0FFC3371D8BD6175316AB32C1C5F65452051 1 22A079D49C5351EFDC1410C81A1F6D8B2E3B79CFF20A30690C118FE2050F72CB 1 0FFC28B923A4654E261DB4CB5B9BABEFCB4DB189B20F52412B0CC9CCCBB8A3B2 1 1EE967C43EF1A3F487061D21B07076A26C126AAF7712E7B5CF5A53688DDD5CC0 1 009ED4D65879CA81DA8227D34CEA3B759B4627E1E2FFB273E9645CD4F3B10F19 1 1CF070212E1E213AEB472F56EDFC9D48009796C77B2D8CC16F2836E37B8715C2 1 04954F0B7B468781BAAE3291DD0E6FFA7F1AF66CAA4094D37B24363CC34606FB 1 115367CB755E9DB18781B3825CB1AEE2C334558B2C038E13DF57BB57CE1CF847 1 110D37EC05862EE2757A7DF39E814876FC97376FF8105D2D29619CB575537BDE 1 13C559A9563FCE083B3B39AE7E8FCA4099BEF3A4C8C6672E543D521F9DA88F96 1 137D87CC22ACC1B6B8C20EABE59F6ED456A58FE4CBEEFDFC4FA9B87E3EF32D17 1 00A2A9711737AAF0404F35AE502887AC6172B2B57D236BD4A40B45F659BFC696',
            },
          },
        },
        tag: 'tag',
        credDefId: didIndyCredentialDefinitionId,
      },
      revocationRegistryDefinitionMetadata: {
        issuanceType: 'ISSUANCE_BY_DEFAULT',
        didIndyNamespace: 'pool:localtest',
      },
      resolutionMetadata: {},
    })

    const legacyRevocationStatusList = await indyVdrAnonCredsRegistry.getRevocationStatusList(
      agent.context,
      legacyRevocationRegistryId,
      entryResponse.result.txnMetadata.txnTime
    )

    expect(legacyRevocationStatusList).toMatchObject({
      resolutionMetadata: {},
      revocationStatusList: {
        issuerId: legacyIssuerId,
        currentAccumulator: '1',
        revRegId: legacyRevocationRegistryId,
        revocationList: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
        timestamp: entryResponse.result.txnMetadata.txnTime,
      },
      revocationStatusListMetadata: {
        didIndyNamespace: 'pool:localtest',
      },
    })

    const didIndyRevocationStatusList = await indyVdrAnonCredsRegistry.getRevocationStatusList(
      agent.context,
      didIndyRevocationRegistryId,
      entryResponse.result.txnMetadata.txnTime
    )

    expect(didIndyRevocationStatusList).toMatchObject({
      resolutionMetadata: {},
      revocationStatusList: {
        issuerId: didIndyIssuerId,
        currentAccumulator: '1',
        revRegId: didIndyRevocationRegistryId,
        revocationList: [
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ],
        timestamp: entryResponse.result.txnMetadata.txnTime,
      },
      revocationStatusListMetadata: {
        didIndyNamespace: 'pool:localtest',
      },
    })
  })
})
