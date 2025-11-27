import {
  AskarModule,
  AskarMultiWalletDatabaseScheme,
  AskarStoreManager,
  transformPrivateKeyToPrivateJwk,
} from '@credo-ts/askar'
import {
  Agent,
  DidDocument,
  JsonTransformer,
  Mdoc,
  MdocRecord,
  SdJwtVcRecord,
  TypedArrayEncoder,
  W3cCredentialRecord,
  W3cCredentialsModule,
  W3cJsonLdVerifiableCredential,
  W3cV2CredentialRecord,
  W3cV2JwtVerifiableCredential,
} from '@credo-ts/core'
import { DrizzleStorageModule } from '@credo-ts/drizzle-storage'
import { agentDependencies } from '@credo-ts/node'
import { askar, askarPostgresStorageConfig } from '../../askar/tests/helpers'
import didKeyP256 from '../../core/src/modules/dids/__tests__/__fixtures__/didKeyP256.json'
import { sprindFunkeTestVectorBase64Url } from '../../core/src/modules/mdoc/__tests__/mdoc.fixtures'
import { sdJwtVcWithSingleDisclosure } from '../../core/src/modules/sd-jwt-vc/__tests__/sdjwtvc.fixtures'
import { customDocumentLoader } from '../../core/src/modules/vc/data-integrity/__tests__/documentLoader'
import { Ed25519Signature2018Fixtures } from '../../core/src/modules/vc/data-integrity/__tests__/fixtures'
import { CredoEs256DidJwkJwtVc } from '../../core/src/modules/vc/jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import testLogger from '../../core/tests/logger'
import { actionMenuBundle } from '../../drizzle-storage/src/action-menu/bundle'
import { anoncredsBundle } from '../../drizzle-storage/src/anoncreds/bundle'
import { coreBundle } from '../../drizzle-storage/src/core/bundle'
import { didcommBundle } from '../../drizzle-storage/src/didcomm/bundle'
import { tenantsBundle } from '../../drizzle-storage/src/tenants/bundle'
import {
  createDrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
  pushDrizzleSchema,
} from '../../drizzle-storage/tests/testDatabase'
import { TenantAgent, TenantsModule } from '../../tenants/src'
import { AskarToDrizzleStorageMigrator } from '../src'

async function populateDatabaseWithRecords(agent: Agent | TenantAgent) {
  await agent.genericRecords.save({
    content: {
      hey: 'there',
    },
  })
  await agent.sdJwtVc.store({
    record: new SdJwtVcRecord({
      credentialInstances: [
        {
          compactSdJwtVc: sdJwtVcWithSingleDisclosure,
        },
      ],
    }),
  })
  await agent.mdoc.store({ record: MdocRecord.fromMdoc(Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url)) })
  await agent.w3cCredentials.store({
    record: W3cCredentialRecord.fromCredential(
      JsonTransformer.fromJSON(Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED, W3cJsonLdVerifiableCredential)
    ),
  })
  await agent.w3cV2Credentials.store({
    record: W3cV2CredentialRecord.fromCredential(W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc)),
  })
  await agent.dids.import({
    did: didKeyP256.id,
    didDocument: DidDocument.fromJSON(didKeyP256),
  })

  const { privateJwk } = transformPrivateKeyToPrivateJwk({
    type: {
      crv: 'Ed25519',
      kty: 'OKP',
    },
    privateKey: TypedArrayEncoder.fromString('afjdemoverysercure00000000000000'),
  })

  privateJwk.kid = 'consistent-kid'
  await agent.kms.importKey({
    privateJwk,
  })
}

async function expectDatabaseWithRecords(agent: Agent | TenantAgent) {
  await expect(agent.genericRecords.getAll()).resolves.toMatchObject([
    {
      content: {
        hey: 'there',
      },
    },
  ])

  await expect(agent.sdJwtVc.getAll()).resolves.toMatchObject([
    {
      credentialInstances: [
        {
          compactSdJwtVc: sdJwtVcWithSingleDisclosure,
        },
      ],
    },
  ])

  await expect(agent.mdoc.getAll()).resolves.toMatchObject([
    {
      credentialInstances: [
        {
          issuerSignedBase64Url: Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url).encoded,
        },
      ],
    },
  ])

  await expect(agent.w3cCredentials.getAll()).resolves.toMatchObject([
    {
      credentialInstances: [
        {
          credential: Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        },
      ],
    },
  ])

  await expect(agent.w3cV2Credentials.getAll()).resolves.toMatchObject([
    {
      credentialInstances: [
        {
          credential: CredoEs256DidJwkJwtVc,
        },
      ],
    },
  ])

  await expect(agent.dids.getCreatedDids()).resolves.toMatchObject([
    {
      didDocument: DidDocument.fromJSON(didKeyP256),
      did: didKeyP256.id,
    },
  ])
}

describe('Askar to Drizzle Migration', () => {
  test.each(['sqlite', 'postgres'] as const)(
    '%s askar to drizzle successful migration and deletion',
    async (databaseType) => {
      const storeId = `askar ${databaseType} to drizzle ${databaseType} successful migration ${Math.random()}`

      const postgresDatabase = databaseType === 'postgres' ? await createDrizzlePostgresTestDatabase() : undefined
      const database = postgresDatabase?.drizzle ?? (await inMemoryDrizzleSqliteDatabase())

      const drizzleModule = new DrizzleStorageModule({
        bundles: [coreBundle, didcommBundle, actionMenuBundle, anoncredsBundle],
        database,
      })

      const askarModule = new AskarModule({
        askar,
        store: {
          id: storeId,
          key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
          keyDerivationMethod: 'raw',
          database: databaseType === 'postgres' ? askarPostgresStorageConfig : undefined,
        },
      })

      await pushDrizzleSchema(drizzleModule)

      const migrator = await AskarToDrizzleStorageMigrator.initialize({
        drizzleModule,
        askarModule,
        agentDependencies,
        logger: testLogger,
      })

      const askarAgent = new Agent({
        dependencies: agentDependencies,
        config: {
          logger: testLogger,
        },
        modules: {
          askar: askarModule,
          w3cCredentials: new W3cCredentialsModule({
            documentLoader: customDocumentLoader,
          }),
        },
      })
      await askarAgent.initialize()

      await populateDatabaseWithRecords(askarAgent)

      await migrator.migrate()

      const drizzleAgent = new Agent({
        dependencies: agentDependencies,
        config: {
          logger: testLogger,
        },
        modules: {
          drizzle: drizzleModule,
        },
      })
      await drizzleAgent.initialize()

      // Now expect all the populated records to be available in the Drizzle database
      await expectDatabaseWithRecords(drizzleAgent)

      // We also still expect all the populated records to be available in the Askar database
      await expectDatabaseWithRecords(askarAgent)

      // After succesfull migration we delete the storage records
      await migrator.deleteStorageRecords()

      // It should not have deleted the keys
      expect(await askarAgent.kms.getPublicKey({ keyId: 'consistent-kid' })).toEqual({
        crv: 'Ed25519',
        kid: 'consistent-kid',
        kty: 'OKP',
        x: 'Df70zEA2tkZXPZxgc0KcM3s_vjut-PP_6QnM5AfLNfo',
      })

      // But it should have deleted the other records
      expect(await askarAgent.genericRecords.getAll()).toEqual([])

      await postgresDatabase?.teardown()
      await askarAgent.shutdown()
      await drizzleAgent.shutdown()
    }
  )

  test.each(['sqlite', 'postgres'])('%s askar to drizzle with tenants successful migration', async (databaseType) => {
    const storeId = `${Math.random()} askar ${databaseType} to drizzle ${databaseType} with tenants successful migration`

    const postgresDatabase = databaseType === 'postgres' ? await createDrizzlePostgresTestDatabase() : undefined

    const database = postgresDatabase?.drizzle ?? (await inMemoryDrizzleSqliteDatabase())
    const drizzleModule = new DrizzleStorageModule({
      bundles: [coreBundle, didcommBundle, actionMenuBundle, anoncredsBundle, tenantsBundle],
      database,
    })

    const askarModule = new AskarModule({
      askar,
      store: {
        id: storeId,
        key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
        keyDerivationMethod: 'raw',
        database: databaseType === 'postgres' ? askarPostgresStorageConfig : undefined,
      },
      multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
    })

    await pushDrizzleSchema(drizzleModule)

    const migrator = await AskarToDrizzleStorageMigrator.initialize({
      drizzleModule,
      askarModule,
      tenantsModule: new TenantsModule(),
      agentDependencies,
      logger: testLogger,
    })

    const askarAgent = new Agent({
      dependencies: agentDependencies,
      config: {
        logger: testLogger,
      },
      modules: {
        askar: askarModule,
        w3cCredentials: new W3cCredentialsModule({
          documentLoader: customDocumentLoader,
        }),
        tenants: new TenantsModule(),
      },
    })
    await askarAgent.initialize()

    await populateDatabaseWithRecords(askarAgent)

    // Create 3 tenants
    const tenant1 = await askarAgent.modules.tenants.createTenant({ config: { label: 'Tenant 1' } })
    const tenant2 = await askarAgent.modules.tenants.createTenant({ config: { label: 'Tenant 2' } })
    const tenant3 = await askarAgent.modules.tenants.createTenant({ config: { label: 'Tenant 3' } })

    // Populate 3 tenants
    await askarAgent.modules.tenants.withTenantAgent({ tenantId: tenant1.id }, (tenantAgent) =>
      populateDatabaseWithRecords(tenantAgent)
    )
    await askarAgent.modules.tenants.withTenantAgent({ tenantId: tenant2.id }, (tenantAgent) =>
      populateDatabaseWithRecords(tenantAgent)
    )
    await askarAgent.modules.tenants.withTenantAgent({ tenantId: tenant3.id }, (tenantAgent) =>
      populateDatabaseWithRecords(tenantAgent)
    )

    await migrator.migrate()

    const drizzleAgent = new Agent({
      dependencies: agentDependencies,
      config: {
        logger: testLogger,
      },
      modules: {
        drizzle: drizzleModule,
        tenants: new TenantsModule(),
      },
    })
    await drizzleAgent.initialize()

    // Now expect all the populated records to be available in the Drizzle database
    await expectDatabaseWithRecords(drizzleAgent)

    // We also still expect all the populated records to be available in the Askar database
    await expectDatabaseWithRecords(askarAgent)

    // And in the tenants databases
    await drizzleAgent.modules.tenants.withTenantAgent({ tenantId: tenant1.id }, async (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )
    await drizzleAgent.modules.tenants.withTenantAgent({ tenantId: tenant2.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )
    await drizzleAgent.modules.tenants.withTenantAgent({ tenantId: tenant3.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )
    // And in the tenants databases
    await askarAgent.modules.tenants.withTenantAgent({ tenantId: tenant1.id }, async (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )
    await askarAgent.modules.tenants.withTenantAgent({ tenantId: tenant2.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )
    await askarAgent.modules.tenants.withTenantAgent({ tenantId: tenant3.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )

    // After succesfull migration we delete the storage records
    await migrator.deleteStorageRecords()

    // It should not have deleted the keys
    expect(await askarAgent.kms.getPublicKey({ keyId: 'consistent-kid' })).toEqual({
      crv: 'Ed25519',
      kid: 'consistent-kid',
      kty: 'OKP',
      x: 'Df70zEA2tkZXPZxgc0KcM3s_vjut-PP_6QnM5AfLNfo',
    })

    // But it should have deleted the other records
    expect(await askarAgent.genericRecords.getAll()).toEqual([])

    const storeManager = askarAgent.context.resolve(AskarStoreManager)
    const { store } = await storeManager.getInitializedStoreWithProfile(askarAgent.context)

    // Should have removed the storage records, but kept the kms records
    const tenant1Session = await store.session(`tenant-${tenant1.id}`).open()
    expect(await tenant1Session.fetchAll({})).toHaveLength(0)
    expect(await tenant1Session.fetchAllKeys({})).toHaveLength(1)
    await tenant1Session.close()

    // Should have removed the storage records, but kept the kms records
    const tenant2Session = await store.session(`tenant-${tenant2.id}`).open()
    expect(await tenant2Session.fetchAll({})).toHaveLength(0)
    expect(await tenant2Session.fetchAllKeys({})).toHaveLength(1)
    await tenant2Session.close()

    // Should have removed the storage records, but kept the kms records
    const tenant3Session = await store.session(`tenant-${tenant3.id}`).open()
    expect(await tenant3Session.fetchAll({})).toHaveLength(0)
    expect(await tenant3Session.fetchAllKeys({})).toHaveLength(1)
    await tenant3Session.close()

    await askarAgent.shutdown()
    await drizzleAgent.shutdown()
    await postgresDatabase?.teardown()
  })
})
