import { transformPrivateKeyToPrivateJwk } from '@credo-ts/askar'
import { Agent, JsonTransformer, TypedArrayEncoder } from '@credo-ts/core'

import { getAgentOptions } from '../../core/tests/helpers'
import { CheqdAnonCredsRegistry, type CheqdDidCreateOptions } from '../src'
import { cheqdPayerSeeds, getCheqdModules } from './setupCheqdModule'

export function cheqdAnonCredsRegistryTest(useCache: boolean) {
  let issuerId: string
  const agent = new Agent(getAgentOptions('cheqdAnonCredsRegistry', {}, {}, getCheqdModules(cheqdPayerSeeds[2])))
  beforeAll(async () => {
    await agent.initialize()

    const registry = agent.modules.anoncreds.config.registries.find(
      (registry): registry is CheqdAnonCredsRegistry => registry instanceof CheqdAnonCredsRegistry
    )

    if (!registry) {
      throw new Error('No cheqd registry found')
    }
    registry.allowsCaching = useCache
  })

  afterAll(async () => {
    await agent.shutdown()
  })

  let credentialDefinitionId: string

  // One test as the credential definition depends on the schema
  test('register and resolve a schema and credential definition', async () => {
    const privateKey = TypedArrayEncoder.fromString('000000000000000000000000000cheqd')
    const { privateJwk } = transformPrivateKeyToPrivateJwk({
      privateKey,
      type: {
        crv: 'Ed25519',
        kty: 'OKP',
      },
    })

    const createdKey = await agent.kms.importKey({
      privateJwk,
    })

    const did = await agent.dids.create<CheqdDidCreateOptions>({
      method: 'cheqd',
      options: {
        keyId: createdKey.keyId,
        network: 'testnet',
        methodSpecificIdAlgo: 'uuid',
      },
    })
    if (did.didState.state !== 'finished') {
      throw new Error(`Did creation failed ${JSON.stringify(did.didState, null, 2)}`)
    }
    issuerId = did.didState.did

    const dynamicVersion = `1.${Math.random() * 100}`

    const schemaResult = await agent.modules.anoncreds.registerSchema({
      schema: {
        attrNames: ['name'],
        issuerId,
        name: 'test11',
        version: dynamicVersion,
      },
      options: {},
    })

    expect(JsonTransformer.toJSON(schemaResult)).toMatchObject({
      schemaState: {
        state: 'finished',
        schema: {
          attrNames: ['name'],
          issuerId,
          name: 'test11',
          version: dynamicVersion,
        },
        schemaId: `${schemaResult.schemaState.schemaId}`,
      },
      registrationMetadata: {},
      schemaMetadata: {},
    })

    const schemaResponse = await agent.modules.anoncreds.getSchema(`${schemaResult.schemaState.schemaId}`)
    expect(schemaResponse).toMatchObject({
      schema: {
        attrNames: ['name'],
        name: 'test11',
        version: dynamicVersion,
        issuerId,
      },
      schemaId: `${schemaResult.schemaState.schemaId}`,
      resolutionMetadata: {},
      schemaMetadata: {},
    })

    const credentialDefinitionResult = await agent.modules.anoncreds.registerCredentialDefinition({
      credentialDefinition: {
        issuerId,
        tag: 'TAG',
        schemaId: `${schemaResult.schemaState.schemaId}`,
      },
      options: {
        supportRevocation: true,
      },
    })

    expect(credentialDefinitionResult).toMatchObject({
      credentialDefinitionState: {
        credentialDefinition: {
          issuerId,
          tag: 'TAG',
          schemaId: schemaResult.schemaState.schemaId,
          type: 'CL',
          value: {
            primary: {
              n: expect.any(String),
              s: expect.any(String),
              r: {
                name: expect.any(String),
                master_secret: expect.any(String),
              },
              rctxt: expect.any(String),
              z: expect.any(String),
            },
          },
        },
        credentialDefinitionId: credentialDefinitionResult.credentialDefinitionState.credentialDefinitionId,
        state: 'finished',
      },
    })

    credentialDefinitionId = credentialDefinitionResult.credentialDefinitionState.credentialDefinitionId as string

    const credentialDefinitionResponse = await agent.modules.anoncreds.getCredentialDefinition(
      credentialDefinitionResult.credentialDefinitionState.credentialDefinitionId as string
    )

    expect(credentialDefinitionResponse).toMatchObject({
      credentialDefinitionId: credentialDefinitionResult.credentialDefinitionState.credentialDefinitionId,
      credentialDefinition: {
        issuerId,
        schemaId: schemaResult.schemaState.schemaId,
        tag: 'TAG',
        type: 'CL',
        value: {
          primary: {
            n: credentialDefinitionResult.credentialDefinitionState.credentialDefinition?.value.primary.n,
            r: credentialDefinitionResult.credentialDefinitionState.credentialDefinition?.value.primary.r,
            rctxt: credentialDefinitionResult.credentialDefinitionState.credentialDefinition?.value.primary.rctxt,
            s: credentialDefinitionResult.credentialDefinitionState.credentialDefinition?.value.primary.s,
            z: credentialDefinitionResult.credentialDefinitionState.credentialDefinition?.value.primary.z,
          },
        },
      },
    })
  })

  // Should not resolve invalid schema
  test('false test cases', async () => {
    const invalidSchemaResourceId =
      'did:cheqd:testnet:d8ac0372-0d4b-413e-8ef5-8e8f07822b2c/resources/ffd001c2-1f80-4cd8-84b2-945fba309457'
    const schemaResponse = await agent.modules.anoncreds.getSchema(`${invalidSchemaResourceId}`)

    expect(schemaResponse).toMatchObject({
      resolutionMetadata: {
        error: 'notFound',
      },
      schemaMetadata: {},
    })
  })

  // Should resolve query based url
  test('resolve query based url', async () => {
    const schemaResourceId = `${issuerId}?resourceName=test11-Schema&resourceType=anonCredsSchema`

    if (!issuerId) {
      throw new Error('Missing issuerId')
    }

    const schemaResponse = await agent.modules.anoncreds.getSchema(schemaResourceId)
    expect(schemaResponse).toMatchObject({
      schema: {
        attrNames: ['name'],
        name: 'test11',
      },
    })
  })

  test('register and resolve revocation registry definition and statusList', async () => {
    const registerRevocationDefinitionResponse = await agent.modules.anoncreds.registerRevocationRegistryDefinition({
      options: {},
      revocationRegistryDefinition: {
        issuerId,
        credentialDefinitionId,
        maximumCredentialNumber: 666,
        tag: 'TAG',
      },
    })

    if (!registerRevocationDefinitionResponse.revocationRegistryDefinitionState.revocationRegistryDefinitionId)
      throw new Error('Revocation registry definition ID not found')

    const revocationRegistryDefinitionId =
      registerRevocationDefinitionResponse.revocationRegistryDefinitionState.revocationRegistryDefinitionId

    const revocationRegistryDefinitionResponse =
      await agent.modules.anoncreds.getRevocationRegistryDefinition(revocationRegistryDefinitionId)

    expect(revocationRegistryDefinitionResponse.revocationRegistryDefinition).toMatchObject({
      revocDefType: 'CL_ACCUM',
      credDefId: credentialDefinitionId,
      tag: 'TAG',
      value: {
        publicKeys: {
          accumKey: {
            z: expect.any(String),
          },
        },
        maxCredNum: 666,
        tailsLocation: expect.any(String),
        tailsHash: expect.any(String),
      },
    })

    const registerRevocationStatusListResponse = await agent.modules.anoncreds.registerRevocationStatusList({
      options: {},
      revocationStatusList: {
        issuerId,
        revocationRegistryDefinitionId,
      },
    })

    if (!registerRevocationStatusListResponse.revocationStatusListState.revocationStatusList?.timestamp)
      throw new Error('Revocation status list timestamp not found')

    const statusListTimestamp =
      registerRevocationStatusListResponse.revocationStatusListState.revocationStatusList.timestamp

    const revocationStatusListResponse = await agent.modules.anoncreds.getRevocationStatusList(
      revocationRegistryDefinitionId,
      statusListTimestamp
    )

    expect(revocationStatusListResponse.revocationStatusList).toMatchObject({
      revRegDefId: `${revocationRegistryDefinitionId}`,
      revocationList: new Array(666).fill(0),
      currentAccumulator: expect.any(String),
    })
  })
}
