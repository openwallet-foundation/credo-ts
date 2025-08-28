import { AnyDrizzleDatabase } from './DrizzleStorageModuleConfig'

export interface ReactNativeDrizzleMigration {
  journal: {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[]
  }
  migrations: Record<string, string>
}

export interface ReactNativeDrizzleMigrationsOptions<Database extends AnyDrizzleDatabase = AnyDrizzleDatabase> {
  db: Database
  migrations: ReactNativeDrizzleMigration[]
  migrate: (db: Database, migration: ReactNativeDrizzleMigration) => Promise<void>
}

export async function applyReactNativeMigrations<Database extends AnyDrizzleDatabase = AnyDrizzleDatabase>({
  migrate,
  migrations,
  db,
}: ReactNativeDrizzleMigrationsOptions<Database>) {
  for (const migration of migrations) {
    await migrate(db, migration)
  }
}
