import {
  Agent,
  DidDocument,
  JsonTransformer,
  Mdoc,
  W3cJsonLdVerifiableCredential,
  W3cV2JwtVerifiableCredential,
} from '@credo-ts/core'
import { agentDependencies } from '@credo-ts/node'

import { AskarModule, AskarMultiWalletDatabaseScheme } from '@credo-ts/askar'
import { askar, askarPostgresStorageConfig } from '../../askar/tests/helpers'
import testLogger from '../../core/tests/logger'
import { DrizzleStorageModule } from '@credo-ts/drizzle-storage'
import actionMenuDrizzleBundle from '../../drizzle-storage/src/action-menu/bundle'
import anoncredsDrizzleBundle from '../../drizzle-storage/src/anoncreds/bundle'
import coreDrizzleBundle from '../../drizzle-storage/src/core/bundle'
import didcommDrizzleBundle from '../../drizzle-storage/src/didcomm/bundle'
import tenantsDrizzleBundle from '../../drizzle-storage/src/tenants/bundle'
import {
  createDrizzlePostgresTestDatabase,
  inMemoryDrizzleSqliteDatabase,
  pushDrizzleSchema,
} from '../../drizzle-storage/tests/testDatabase'
import { AskarToDrizzleStorageMigrator } from '../src'

import didKeyP256 from '../../core/src/modules/dids/__tests__/__fixtures__/didKeyP256.json'
import { sprindFunkeTestVectorBase64Url } from '../../core/src/modules/mdoc/__tests__/mdoc.fixtures'
import { sdJwtVcWithSingleDisclosure } from '../../core/src/modules/sd-jwt-vc/__tests__/sdjwtvc.fixtures'
import { Ed25519Signature2018Fixtures } from '../../core/src/modules/vc/data-integrity/__tests__/fixtures'
import { CredoEs256DidJwkJwtVc } from '../../core/src/modules/vc/jwt-vc/__tests__/fixtures/credo-jwt-vc-v2'
import { TenantAgent, TenantsModule } from '../../tenants'

async function populateDatabaseWithRecords(agent: Agent | TenantAgent) {
  await agent.genericRecords.save({
    content: {
      hey: 'there',
    },
  })
  await agent.sdJwtVc.store(sdJwtVcWithSingleDisclosure)
  await agent.mdoc.store(Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url))
  await agent.w3cCredentials.storeCredential({
    credential: JsonTransformer.fromJSON(
      Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
      W3cJsonLdVerifiableCredential
    ),
  })
  await agent.w3cV2Credentials.storeCredential({
    credential: W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc),
  })
  await agent.dids.import({
    did: didKeyP256.id,
    didDocument: DidDocument.fromJSON(didKeyP256),
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
      compactSdJwtVc: sdJwtVcWithSingleDisclosure,
    },
  ])

  await expect(agent.mdoc.getAll()).resolves.toMatchObject([
    {
      base64Url: Mdoc.fromBase64Url(sprindFunkeTestVectorBase64Url).encoded,
    },
  ])

  await expect(agent.w3cCredentials.getAllCredentialRecords()).resolves.toMatchObject([
    {
      credential: JsonTransformer.fromJSON(
        Ed25519Signature2018Fixtures.TEST_LD_DOCUMENT_SIGNED,
        W3cJsonLdVerifiableCredential
      ),
    },
  ])

  await expect(agent.w3cV2Credentials.getAllCredentialRecords()).resolves.toMatchObject([
    {
      credential: W3cV2JwtVerifiableCredential.fromCompact(CredoEs256DidJwkJwtVc),
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
  test('askar sqlite to drizzle sqlite successful migration', async () => {
    const storeId = `askar sqlite to drizzle sqlite successful migration ${Math.random()}`

    const drizzleModule = new DrizzleStorageModule({
      bundles: [coreDrizzleBundle, didcommDrizzleBundle, actionMenuDrizzleBundle, anoncredsDrizzleBundle],
      database: inMemoryDrizzleSqliteDatabase(),
    })

    await pushDrizzleSchema(drizzleModule)

    const migrator = await AskarToDrizzleStorageMigrator.initialize({
      drizzleModule,
      askarModule: new AskarModule({
        askar,
        store: {
          id: storeId,
          key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
          keyDerivationMethod: 'raw',
        },
      }),
      agentDependencies,
      logger: testLogger,
    })

    await populateDatabaseWithRecords(migrator.askarAgent)

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

    await drizzleAgent.shutdown()
  })

  test('askar postgres to drizzle postgres successful migration', async () => {
    const storeId = `askar drizzle to drizzle postgres successful migration ${Math.random()}`

    const postgresDatabase = await createDrizzlePostgresTestDatabase()

    const drizzleModule = new DrizzleStorageModule({
      bundles: [coreDrizzleBundle, didcommDrizzleBundle, actionMenuDrizzleBundle, anoncredsDrizzleBundle],
      database: postgresDatabase.drizzle,
    })

    await pushDrizzleSchema(drizzleModule)

    const migrator = await AskarToDrizzleStorageMigrator.initialize({
      drizzleModule,
      askarModule: new AskarModule({
        askar,
        store: {
          id: storeId,
          key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
          keyDerivationMethod: 'raw',
          database: askarPostgresStorageConfig,
        },
      }),
      agentDependencies,
      logger: testLogger,
    })

    await populateDatabaseWithRecords(migrator.askarAgent)

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

    await drizzleAgent.shutdown()
    await postgresDatabase.teardown()
  })

  test('askar sqlite to drizzle sqlite with tenants successful migration', async () => {
    const storeId = `askar sqlite to drizzle sqlite with tenants successful migration ${Math.random()}`

    const drizzleModule = new DrizzleStorageModule({
      bundles: [
        coreDrizzleBundle,
        didcommDrizzleBundle,
        actionMenuDrizzleBundle,
        anoncredsDrizzleBundle,
        tenantsDrizzleBundle,
      ],
      database: inMemoryDrizzleSqliteDatabase(),
    })

    await pushDrizzleSchema(drizzleModule)

    const migrator = await AskarToDrizzleStorageMigrator.initialize({
      drizzleModule,
      askarModule: new AskarModule({
        askar,
        store: {
          id: storeId,
          key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
          keyDerivationMethod: 'raw',
        },
        multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
      }),
      tenantsModule: new TenantsModule(),
      agentDependencies,
      logger: testLogger,
    })

    await populateDatabaseWithRecords(migrator.askarAgent)

    const askarAgent = migrator.askarAgent as Agent<{ tenants: TenantsModule }>

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

    // And in the tenants databases
    await drizzleAgent.modules.tenants.withTenantAgent({ tenantId: tenant1.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )
    await drizzleAgent.modules.tenants.withTenantAgent({ tenantId: tenant2.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )
    await drizzleAgent.modules.tenants.withTenantAgent({ tenantId: tenant3.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )

    await drizzleAgent.shutdown()
  })

  test('askar postgres to drizzle postgres with tenants successful migration', async () => {
    const storeId = `askar postgres to drizzle postgres with tenants successful migration ${Math.random()}`

    const postgresDatabase = await createDrizzlePostgresTestDatabase()

    const drizzleModule = new DrizzleStorageModule({
      bundles: [
        coreDrizzleBundle,
        didcommDrizzleBundle,
        actionMenuDrizzleBundle,
        anoncredsDrizzleBundle,
        tenantsDrizzleBundle,
      ],
      database: postgresDatabase.drizzle,
    })

    await pushDrizzleSchema(drizzleModule)

    const migrator = await AskarToDrizzleStorageMigrator.initialize({
      drizzleModule,
      askarModule: new AskarModule({
        askar,
        store: {
          id: storeId,
          key: 'GfwU1DC7gEZNs3w41tjBiZYj7BNToDoFEqKY6wZXqs1A',
          keyDerivationMethod: 'raw',
        },
        multiWalletDatabaseScheme: AskarMultiWalletDatabaseScheme.ProfilePerWallet,
      }),
      tenantsModule: new TenantsModule(),
      agentDependencies,
      logger: testLogger,
    })

    await populateDatabaseWithRecords(migrator.askarAgent)

    const askarAgent = migrator.askarAgent as Agent<{ tenants: TenantsModule }>

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

    // And in the tenants databases
    await drizzleAgent.modules.tenants.withTenantAgent({ tenantId: tenant1.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )
    await drizzleAgent.modules.tenants.withTenantAgent({ tenantId: tenant2.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )
    await drizzleAgent.modules.tenants.withTenantAgent({ tenantId: tenant3.id }, (tenantAgent) =>
      expectDatabaseWithRecords(tenantAgent)
    )

    await drizzleAgent.shutdown()
    await postgresDatabase.teardown()
  })
})
