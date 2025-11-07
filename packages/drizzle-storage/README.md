<p align="center">
  <br />
  <img
    alt="Credo Logo"
    src="https://github.com/openwallet-foundation/credo-ts/blob/c7886cb8377ceb8ee4efe8d264211e561a75072d/images/credo-logo.png"
    height="250px"
  />
</p>
<h1 align="center"><b>Credo Drizzle Storage Module</b></h1>
<p align="center">
  <a
    href="https://raw.githubusercontent.com/openwallet-foundation/credo-ts/main/LICENSE"
    ><img
      alt="License"
      src="https://img.shields.io/badge/License-Apache%202.0-blue.svg"
  /></a>
  <a href="https://www.typescriptlang.org/"
    ><img
      alt="typescript"
      src="https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg"
  /></a>
    <a href="https://www.npmjs.com/package/@credo-ts/drizzle-storage"
    ><img
      alt="@credo-ts/drizzle-storage version"
      src="https://img.shields.io/npm/v/@credo-ts/drizzle-storage"
  /></a>

</p>
<br />

Credo Drizzle Storage provides a storage integration with Drizzle ORM, with support for PostgreSQL and SQLite.

> NOTE: This package will add SQL migrations in non-breaking releases, requiring the migrations to be ran for Credo to work correctly. We recommend running the migrations continuously during deployments as breaking migrations will only be released in breaking Credo releases. If you don't want to or can't run migrations on a continuous basis (e.g. for every deploy), we recommend either using the Askar storage (which does not define a database schema), or pinning to a specific Credo version.

## Usage

Install the `@credo-ts/drizzle-storage` package and add the `DrizzleStorageModule` module to your agent.

You then need to provide two items to the module on creation:

- The database instance to use
- The database bundles (models) to register.

```ts
import { didcommDrizzleRecords } from "@credo-ts/drizzle-storage/didcomm";

const agent = new Agent({
  modules: {
    drizzleStorage: new DrizzleStorageModule({
      database,
      bundles,
    }),
  },
});
```

### Database

The database instance provides a connection to the actual database. Credo currenlty supports a limited set of the supported PostgreSQL and SQLite database drivers supported by Drizzle.

Because multiple drivers are supported, you need to instantiate your own database instance. You can read installation and setup instructions for all the Drizzle database dirvers in the [Drizzle documentation](https://orm.drizzle.team/docs/get-started).

If you want to use a custom driver that is compatible with Drizzle, please open an issue. Adding new drivers to Credo's Drizzle integration, and mainly requires us to extract the native PostgreSQL or SQLite error code from the driver-specific error class (e.g. `libsql` uses `error.rawCode`, while `pg` uses `error.code`).

#### PostgreSQL using `pg`

```ts
import { drizzle } from "drizzle-orm/node-postgres";

const database = drizzle(
  "postgresql://postgres:postgres@localhost:5432/postgres"
);
```

#### SQLite using `libsql`

```ts
import { drizzle } from "drizzle-orm/libsql";

const database = drizzle("file:./database.db");
```

#### SQLite using `expo-sqlite`

```ts
import { drizzle } from "drizzle-orm/expo-sqlite";
import { openDatabaseSync } from "expo-sqlite/next";

const expo = openDatabaseSync("database.db");
const database = drizzle(expo);
```

You can configure `expo-sqlite` to use `SQLCipher` as the SQLite implementation, which is an open source variant of SQLite supporting encryption of the database.

### Bundles

The bundles provide the agent with the needed context about which record types are used. For each of the modules you use with Credo that provides Record classes, the respective drizzle record MUST be registered, otherwise you cannot use the record, and an error will be thrown when such a record is retrieved, stored, updated or deleted. The `coreDrizzleBundle` is always registered, as these are required to use Credo.

The following bundles are provided out of the box by the Drizzle storage module:

- `coreBundle` from `@credo-ts/drizzle-storage/core` (`core`)
- `didcommBundle` from `@credo-ts/drizzle-storage/didcomm` (`didcomm`)
- `actionMenuBundle` from `@credo-ts/drizzle-storage/action-menu` (`action-menu`)
- `anonCredsBundle` from `@credo-ts/drizzle-storage/anoncreds` (`anoncreds`)
- `openid4vcBundle` from `@credo-ts/drizzle-storage/openid4vc` (`openid4vc`)
- `drpcBundle` from `@credo-ts/drizzle-storage/drpc` (`drpc`)
- `tenantsBundle` from `@credo-ts/drizzle-storage/tenants` (`tenants`)
- `questionAnswerBundle` from `@credo-ts/drizzle-storage/question-answer` (`question-answer`)

> [!IMPORTANT]  
> Make sure to order the bundles to account for any dependencies between modules. For example, the `actionMenuBundle`, depends on the connection record from `didcommBundle`. Generally we recommend to adhere to the order defined above, and always provide custom records after the records provided by the `@credo-ts/drizzle-storage` package.

The following defines the bundles for an agent using the `didcomm` and `anoncreds` extension modules, but doesn't use the `action-menu` extension module:

```ts
const bundles = [coreBundle, didcommBundle, anonCredsBundle] as const;
```

### Migrations

Before actually being able to use the database, you need to ensure the tables exist within the database. Credo provides migrations to correctly setup the database, which must be run before initializing the agent.

The process for applying migrations differs between Node.JS and React Native.

#### Node.JS

In Node.JS we can apply migrations outside of the code with a CLI.

In the example below we're assuming `postgres` is used as the database dialect, but it can also be used with `sqlite`. The following parameters need to be provided to the CLI:

- `bundle` - this defines the record bundles that migrations need to be applied for. For the default records provided by Credo you can just provide the module names (as documented above, `@credo-ts/drizzle-storage/core` becomes `core`). For other modules, consult the documentation of that module on the bundle name to provide. This MUST match with the records being provided and used during runtime in your Credo agent.
- `dialect` - the dialect to use for migrations. Either `postgres` or `sqlite` and MUST match with the database being used during runtime in your Credo agent.
- `database-url` - the url to connect to the database. You can also provide this using the `DRIZZLE_DATABASE_URL` environment variable (recommended).

If the `@credo-ts/drizzle-storage` package is already installed in your project, you can directly use it to run the CLI with the `drizzle-storage` command. You can also use `npx` to execute the CLI, but make sure that you install the correct version matching the version that is used for your runtime agent. You also need to make sure that all extension modules are installed so the migration files can be resolved (which can be done using `--project` in `npx`).

> [!NOTE]  
> When running migrations always make sure to provide the core module. While for the `bundles` in the `DrizzleStorageModule` the `core` bundle is added by default, due to imcreased control over the migration process, no bundles are added by default in the migration command.

```sh
# or npm or yarn
pnpm drizzle-storage migrate --bundle core --bundle didcomm --bundle anoncreds --database-url postgresql://postgres:postgres@localhost:5432/postgres`

# using npx
npx @credo-ts/drizzle-storage@^x.x migrate
```

### React Native

In React Native, we need to apply migrations from within the code, as they need to be applied on every device that is running the Credo agent.

Within your project creat a file that sets up the migrations. It should look something like the example below, but make sure to adapt it based on the SQLite database driver you're uing, and the records you're using.

```ts
import { applyReactNativeMigrations } from "@credo-ts/drizzle-storage";

// or drizzle-orm/op-sqlite/migrator
import { migrate } from "drizzle-orm/expo-sqlite/migrator";

// Uses the same database instance as provided to the agent
import { database } from "./database";

// Import the SQLite migrations for all modules you're using
// If you're using custom modules consult with the documentation of that modules
// to determine where to import the SQLite migrations from.
import coreMigrations from "@credo-ts/drizzle-storage/migrations/core/sqlite/migrations";
import didcommMigrations from "@credo-ts/drizzle-storage/migrations/didcomm/sqlite/migrations";
import anoncredsMigrations from "@credo-ts/drizzle-storage/migrations/anoncreds/sqlite/migrations";

// Execute this method in your code, before initializing the agent. You should do
// this on every agent startup, or if you're sure the agent hasn't updated, you can
// only do it when you have added new modules / updated the Credo version. If there
// are no pending migration, this method will resolve quickly.
export async function applyMyReactNativeMigrations() {
  return await applyReactNativeMigrations({
    migrate,
    database,
    migrations: [coreMigrations, didcommMigrations, anoncredsMigrations],
  });
}
```

> [!NOTE]  
> In the future the CLI used for Node.JS might be extended to generate the scaffolding of this file, but for now it needs to created manually.

In addition you also need to configure React Native to bundle the SQL files in your application bundle, so the SQL can be executed from within the deployed app.

1. Install the `babel-plugin-inline-import` package, and add the `inline-import` plugin to your `babel.config.js`. Make sure to adapt it based on whether you're using Expo or React Native (the import part is adding the plugin):

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [["inline-import", { extensions: [".sql"] }]], // <-- add this
  };
};
```

2. Update your `metro.config.js` and add the `sql` extension. Again, adapt this based on whether you're using Expo or React Native (the important part is adding hte `sourceExts` value):

```js
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push("sql"); // <--- add this

module.exports = config;
```

## Developing storage bundles

Developing a custom Drizzle storage bundle for Credo requires the following:

- A bundle definition describing the records, and metadata about the migrations
- A set of record files with the PostgreSQL and SQLite database definitions, as well as the Credo record adapters.

The Drizzle storage module for Credo is still in an experimental phase, and documentation for creating Drizzle bundles is not available yet. You can look at the bundles from thie repository (such as `action-menu`), to see how a storage bundle can be defined.

> [!WARNING]  
> Drizzle requires TypeScript files to be used for generation of migrations. For this reason if you're developing storage bundles for Drizzle in Credo, you MUST write the storage bundle in TypeScript. We recommend every JavaScript/Credo project to be written in TypeScript, but for Drizzle it is required.
