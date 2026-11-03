---
"@credo-ts/didcomm": patch
---

A message pickup v2 recipient now processes the messages of a delivery in order and only sends `messages-received` once they have been processed. Before, the acknowledgement was sent while the messages were still being processed, so the mediator could delete messages that were never handled if the agent stopped in between. Messages delivered through pickup v2 no longer go through the `DidCommMessageReceived` event.

Added `DidCommMessageReceiver.receiveMessageAndReportFailure`, which emits a `DidCommMessageProcessingFailed` event instead of throwing when processing fails.
