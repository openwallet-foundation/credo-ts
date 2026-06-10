---
"@credo-ts/drizzle-storage": patch
"@credo-ts/question-answer": patch
"@credo-ts/action-menu": patch
"@credo-ts/anoncreds": patch
"@credo-ts/openid4vc": patch
"@credo-ts/didcomm": patch
"@credo-ts/askar": patch
"@credo-ts/webvh": patch
"@credo-ts/core": patch
"@credo-ts/drpc": patch
---

TokenStatusList is a new standard module on the agent. It allows you to create/update/fetch token status lists. It is up to the user to host this, this can be easily done with the `statusList` you receive from the `agent.tokenStatusList.createTokenStatusList(...)` function. Updating the statuslist allows you to change the status list credential state from valid to invalid, but also update the expiry time, rotate certificates, change signing algorithm, etc. Signatures are the default and mac should only be used if the user is aware of the security implications and has good reason to do so.
