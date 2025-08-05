---
"@credo-ts/didcomm": minor
"@credo-ts/core": minor
---

`MessagePickupRepository` has been refactored to `QueueTransportRepository`, and now belongs to DIDComm module configuration. As a result, MessagePickupRepository injection symbol has been dropped. If you want to retrieve current QueueTransportRepository instance, resolve DidCommModuleConfig and get `queueTransportRepository`.

All methods in QueueTransportRepository now include `AgentContext` as their first argument.
