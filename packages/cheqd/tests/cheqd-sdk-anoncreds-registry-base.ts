import { transformPrivateKeyToPrivateJwk } from '@credo-ts/askar'
import { Agent, JsonTransformer, TypedArrayEncoder } from '@credo-ts/core'

import { getAgentOptions } from '../../core/tests/helpers'
import { CheqdAnonCredsRegistry, type CheqdDidCreateOptions } from '../src'
import { getCheqdModules } from './setupCheqdModule'

const cheqdWriteRetryConfig = {
  maxAttempts: 4,
  initialBackoffMs: 500,
  maxBackoffMs: 5000,
}

async function withCheqdWriteRetry<T>(operationName: string, operation: () => Promise<T>) {
  let lastError: unknown

  for (let attempt = 1; attempt <= cheqdWriteRetryConfig.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt === cheqdWriteRetryConfig.maxAttempts) {
        throw new Error(
          `${operationName} failed (attempt ${attempt}/${cheqdWriteRetryConfig.maxAttempts}, marker=transient/network): ${error instanceof Error ? error.message : String(error)}`
        )
      }

      const backoffMs = Math.min(
        cheqdWriteRetryConfig.initialBackoffMs * 2 ** (attempt - 1),
        cheqdWriteRetryConfig.maxBackoffMs
      )
      await new Promise((resolve) => setTimeout(resolve, backoffMs))
    }
  }

  throw new Error(
    `${operationName} failed (attempt ${cheqdWriteRetryConfig.maxAttempts}/${cheqdWriteRetryConfig.maxAttempts}, marker=transient/network): ${lastError instanceof Error ? lastError.message : String(lastError)}`
  )
}

export function cheqdAnonCredsRegistryTest(useCache: boolean, cheqdPayerSeed: string) {
  let issuerId: string
  const agent = new Agent(getAgentOptions('cheqdAnonCredsRegistry', {}, {}, getCheqdModules(cheqdPayerSeed)))
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
    const privateKey = TypedArrayEncoder.fromUtf8String(`000000000000000000000${useCache ? 'cached' : '000000'}cheqd`)
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

    const did = await withCheqdWriteRetry('did.create', async () => {
      const didCreateResult = await agent.dids.create<CheqdDidCreateOptions>({
        method: 'cheqd',
        options: {
          keyId: createdKey.keyId,
          network: 'testnet',
          methodSpecificIdAlgo: 'uuid',
        },
      })

      if (didCreateResult.didState.state !== 'finished') {
        throw new Error(`Did creation failed: ${didCreateResult.didState.reason ?? didCreateResult.didState.state}`)
      }

      return didCreateResult
    })
    issuerId = did.didState.did

    const dynamicVersion = `1.${Math.random() * 100}`

    const schemaResult = await withCheqdWriteRetry('anoncreds.registerSchema', () =>
      agent.modules.anoncreds.registerSchema({
        schema: {
          attrNames: ['name'],
          issuerId,
          name: 'test11',
          version: dynamicVersion,
        },
        options: {},
      })
    )

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

    const credentialDefinitionResult = await withCheqdWriteRetry(
      'anoncreds.registerCredentialDefinition',
      async () => {
        const result = await agent.modules.anoncreds.registerCredentialDefinition({
          credentialDefinition: {
            issuerId,
            tag: 'TAG',
            schemaId: `${schemaResult.schemaState.schemaId}`,
          },
          options: {
            supportRevocation: true,
          },
        })
        const credentialDefinitionState = result.credentialDefinitionState

        if (credentialDefinitionState.state !== 'finished' || !credentialDefinitionState.credentialDefinitionId) {
          throw new Error(
            `Credential definition creation failed: state=${credentialDefinitionState.state}`
          )
        }

        return result
      }
    )

    const credentialDefinitionState = credentialDefinitionResult.credentialDefinitionState

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

    credentialDefinitionId = credentialDefinitionState.credentialDefinitionId

    const credentialDefinitionResponse = await agent.modules.anoncreds.getCredentialDefinition(
      credentialDefinitionState.credentialDefinitionId
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
    if (!credentialDefinitionId) {
      throw new Error('Missing credentialDefinitionId')
    }

    const registerRevocationDefinitionResponse = await withCheqdWriteRetry(
      'anoncreds.registerRevocationRegistryDefinition',
      async () => {
        const result = await agent.modules.anoncreds.registerRevocationRegistryDefinition({
          options: {},
          revocationRegistryDefinition: {
            issuerId,
            credentialDefinitionId,
            maximumCredentialNumber: 666,
            tag: 'TAG',
          },
        })
        if (result.revocationRegistryDefinitionState.state !== 'finished') {
          throw new Error(`Revocation registry definition creation failed: ${result.revocationRegistryDefinitionState.state}`)
        }

        return result
      }
    )

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

    const registerRevocationStatusListResponse = await withCheqdWriteRetry(
      'anoncreds.registerRevocationStatusList',
      async () => {
        const result = await agent.modules.anoncreds.registerRevocationStatusList({
          options: {},
          revocationStatusList: {
            issuerId,
            revocationRegistryDefinitionId,
          },
        })
        if (result.revocationStatusListState.state !== 'finished') {
          throw new Error(`Revocation status list creation failed: ${result.revocationStatusListState.state}`)
        }

        return result
      }
    )

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
