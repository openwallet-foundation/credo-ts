---
'@credo-ts/didcomm': patch
---

`MessageSendingError` now has a `reason` with a `category` and the `attempts` that were made: the transport session, each service endpoint and the queue, each with a result (`MessageSendingSessionResult`, `MessageSendingServiceResult`, `MessageSendingQueueResult`). The error message still lists the reasons in readable form. Code that creates a `MessageSendingError` itself now has to pass a `reason`.

An undeliverable message is no longer always logged as an error. The log level follows the category: `RecipientUnreachable` is logged at info level (the recipient has no reachable endpoint and no usable queue, or closed its session), `RemoteError` as a warning (an endpoint of the recipient failed or their DID document could not be used) and `InternalError` as an error (no outbound transport, a packing or key problem, or a session that was already used for another message). Errors are thrown as before. Hosts that log or report these errors themselves can use the category to choose their own level.

```ts
try {
  await agent.didcomm.basicMessages.sendMessage(connectionId, 'Hello')
} catch (error) {
  if (error instanceof MessageSendingError && error.reason.category === MessageSendingErrorCategory.RecipientUnreachable) {
    // the recipient is offline, not something to alert on
  }
}
```

`DidCommMessageSender.sendPackage` no longer drops a message without an error when no outbound transport supports the scheme of a service. It tries the next service or the queue.
