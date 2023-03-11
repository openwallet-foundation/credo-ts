import { Agent, Key, KeyType, TypedArrayEncoder } from '@aries-framework/core'

import {
  agentDependencies,
  getAgentConfig,
  importExistingIndyDidFromPrivateKey,
  publicDidSeed,
} from '../../core/tests/helpers'
import { IndySdkAnonCredsRegistry } from '../src/anoncreds/services/IndySdkAnonCredsRegistry'
import { IndySdkPoolService } from '../src/ledger'

import { credentialDefinitionValue } from './__fixtures__/anoncreds'
import { getIndySdkModules, indySdk } from './setupIndySdkModule'

const agentConfig = getAgentConfig('IndySdkAnonCredsRegistry')
const indySdkModules = getIndySdkModules()

const agent = new Agent({
  config: agentConfig,
  dependencies: agentDependencies,
  modules: indySdkModules,
})

const indySdkAnonCredsRegistry = new IndySdkAnonCredsRegistry()
const indySdkPoolService = agent.dependencyManager.resolve(IndySdkPoolService)
const pool = indySdkPoolService.getPoolForNamespace('pool:localtest')

describe('IndySdkAnonCredsRegistry', () => {
  beforeAll(async () => {
    await agent.initialize()

    // We need to import the endorser did/key into the wallet
    await importExistingIndyDidFromPrivateKey(agent, TypedArrayEncoder.fromString(publicDidSeed))
  })

  afterAll(async () => {
    await agent.shutdown()
    await agent.wallet.delete()
  })

  // TODO: use different issuer for schema and credential definition to catch possible bugs
  // One test as the credential definition depends on the schema
  test('register and resolve a schema and credential definition', async () => {
    const dynamicVersion = `1.${Math.random() * 100}`

    const legacyIssuerId = 'TL1EaPFCZ8Si5aUrqScBDt'
    const signingKey = Key.fromPublicKeyBase58('FMGcFuU3QwAQLywxvmEnSorQT3NwU9wgDMMTaDFtvswm', KeyType.Ed25519)
    const didIndyIssuerId = 'did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt'

    const legacySchemaId = `TL1EaPFCZ8Si5aUrqScBDt:2:test:${dynamicVersion}`
    const didIndySchemaId = `did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/SCHEMA/test/${dynamicVersion}`

    const schemaResult = await indySdkAnonCredsRegistry.registerSchema(agent.context, {
      schema: {
        attrNames: ['name'],
        issuerId: didIndyIssuerId,
        name: 'test',
        version: dynamicVersion,
      },
      options: {},
    })

    expect(schemaResult).toMatchObject({
      schemaState: {
        state: 'finished',
        schema: {
          attrNames: ['name'],
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

    // Resolve using legacy schema id
    const legacySchema = await indySdkAnonCredsRegistry.getSchema(agent.context, legacySchemaId)
    expect(legacySchema).toMatchObject({
      schema: {
        attrNames: ['name'],
        name: 'test',
        version: dynamicVersion,
        issuerId: 'TL1EaPFCZ8Si5aUrqScBDt',
      },
      schemaId: `TL1EaPFCZ8Si5aUrqScBDt:2:test:${dynamicVersion}`,
      resolutionMetadata: {},
      schemaMetadata: {
        didIndyNamespace: 'pool:localtest',
        indyLedgerSeqNo: expect.any(Number),
      },
    })

    // Resolve using did indy schema id
    const didIndySchema = await indySdkAnonCredsRegistry.getSchema(agent.context, didIndySchemaId)
    expect(didIndySchema).toMatchObject({
      schema: {
        attrNames: ['name'],
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
    const credentialDefinitionResult = await indySdkAnonCredsRegistry.registerCredentialDefinition(agent.context, {
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

    // Resolve using legacy credential definition id
    const legacyCredentialDefinition = await indySdkAnonCredsRegistry.getCredentialDefinition(
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
    const didIndyCredentialDefinition = await indySdkAnonCredsRegistry.getCredentialDefinition(
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

    // We don't support creating a revocation registry using AFJ yet, so we directly use indy-sdk to register the revocation registry
    const legacyRevocationRegistryId = `TL1EaPFCZ8Si5aUrqScBDt:4:TL1EaPFCZ8Si5aUrqScBDt:3:CL:${schemaResult.schemaMetadata.indyLedgerSeqNo}:TAG:CL_ACCUM:tag`
    const didIndyRevocationRegistryId = `did:indy:pool:localtest:TL1EaPFCZ8Si5aUrqScBDt/anoncreds/v0/REV_REG_DEF/${schemaResult.schemaMetadata.indyLedgerSeqNo}/TAG/tag`
    const revocationRegistryRequest = await indySdk.buildRevocRegDefRequest('TL1EaPFCZ8Si5aUrqScBDt', {
      id: legacyRevocationRegistryId,
      credDefId: legacyCredentialDefinitionId,
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
        tailsLocation: '/var/folders/l3/xy8jzyvj4p5_d9g1123rt4bw0000gn/T/HLKresYcDSZYSKogq8wive4zyXNY84669MygftLFBG1i',
      },
      ver: '1.0',
    })

    await indySdkPoolService.submitWriteRequest(agent.context, pool, revocationRegistryRequest, signingKey)

    // indySdk.buildRevRegEntry panics, so we just pass a custom request directly
    const entryResponse = await indySdkPoolService.submitWriteRequest(
      agent.context,
      pool,
      {
        identifier: legacyIssuerId,
        operation: {
          revocDefType: 'CL_ACCUM',
          revocRegDefId: legacyRevocationRegistryId,
          type: '114',
          value: {
            accum:
              '1 0000000000000000000000000000000000000000000000000000000000000000 1 0000000000000000000000000000000000000000000000000000000000000000 2 095E45DDF417D05FB10933FFC63D474548B7FFFF7888802F07FFFFFF7D07A8A8 1 0000000000000000000000000000000000000000000000000000000000000000 1 0000000000000000000000000000000000000000000000000000000000000000 1 0000000000000000000000000000000000000000000000000000000000000000',
          },
        },
        protocolVersion: 2,
        reqId: Math.floor(Math.random() * 1000000),
      },
      signingKey
    )

    const legacyRevocationRegistryDefinition = await indySdkAnonCredsRegistry.getRevocationRegistryDefinition(
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

    const didIndyRevocationRegistryDefinition = await indySdkAnonCredsRegistry.getRevocationRegistryDefinition(
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

    const legacyRevocationStatusList = await indySdkAnonCredsRegistry.getRevocationStatusList(
      agent.context,
      legacyRevocationRegistryId,
      entryResponse.result.txnMetadata.txnTime
    )

    expect(legacyRevocationStatusList).toMatchObject({
      resolutionMetadata: {},
      revocationStatusList: {
        issuerId: legacyIssuerId,
        currentAccumulator:
          '1 0000000000000000000000000000000000000000000000000000000000000000 1 0000000000000000000000000000000000000000000000000000000000000000 2 095E45DDF417D05FB10933FFC63D474548B7FFFF7888802F07FFFFFF7D07A8A8 1 0000000000000000000000000000000000000000000000000000000000000000 1 0000000000000000000000000000000000000000000000000000000000000000 1 0000000000000000000000000000000000000000000000000000000000000000',
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

    const didIndyRevocationStatusList = await indySdkAnonCredsRegistry.getRevocationStatusList(
      agent.context,
      didIndyRevocationRegistryId,
      entryResponse.result.txnMetadata.txnTime
    )

    expect(didIndyRevocationStatusList).toMatchObject({
      resolutionMetadata: {},
      revocationStatusList: {
        issuerId: didIndyIssuerId,
        currentAccumulator:
          '1 0000000000000000000000000000000000000000000000000000000000000000 1 0000000000000000000000000000000000000000000000000000000000000000 2 095E45DDF417D05FB10933FFC63D474548B7FFFF7888802F07FFFFFF7D07A8A8 1 0000000000000000000000000000000000000000000000000000000000000000 1 0000000000000000000000000000000000000000000000000000000000000000 1 0000000000000000000000000000000000000000000000000000000000000000',
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
