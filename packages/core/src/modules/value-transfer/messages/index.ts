import type { CashAcceptedMessage } from './CashAcceptedMessage'
import type { CashRemovedMessage } from './CashRemovedMessage'
import type { ReceiptMessage } from './ReceiptMessage'
import type { RejectMessage } from './RejectMessage'
import type { RequestAcceptedMessage } from './RequestAcceptedMessage'
import type { RequestMessage } from './RequestMessage'

export * from './CashAcceptedMessage'
export * from './CashRemovedMessage'
export * from './RequestMessage'
export * from './RequestAcceptedMessage'
export * from './ReceiptMessage'
export * from './RejectMessage'

export type ValueTransferMessage =
  | CashAcceptedMessage
  | CashRemovedMessage
  | RequestMessage
  | RequestAcceptedMessage
  | RejectMessage
  | ReceiptMessage
