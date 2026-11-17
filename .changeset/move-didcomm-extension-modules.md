---
'@credo-ts/drizzle-storage': minor
---

Remove the `action-menu`, `drpc`, and `question-answer` drizzle record bundles. The Action Menu, DRPC, and Question Answer modules moved to the [Credo DIDComm extensions repository](https://github.com/openwallet-foundation/credo-ts-didcomm-ext) as `@credo-ts/didcomm-action-menu`, `@credo-ts/didcomm-drpc`, and `@credo-ts/didcomm-question-answer`. Each package provides its bundle under the `/drizzle` subpath, for example `didcommActionMenuBundle` from `@credo-ts/didcomm-action-menu/drizzle`. The bundle names, the table names, and the migrations did not change, so existing databases keep working. Pass the subpath to the CLI, for example `--bundle @credo-ts/didcomm-action-menu/drizzle` instead of `--bundle action-menu`.
