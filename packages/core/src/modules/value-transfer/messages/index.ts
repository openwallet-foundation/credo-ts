import type { CashAcceptedMessage } from './CashAcceptedMessage'
import type { CashAcceptedWitnessedMessage } from './CashAcceptedWitnessedMessage'
import type { CashRemovedMessage } from './CashRemovedMessage'
import type { GetterReceiptMessage } from './GetterReceiptMessage'
import type { GiverReceiptMessage } from './GiverReceiptMessage'
import type { ProblemReportMessage } from './ProblemReportMessage'
import type { RequestAcceptedMessage } from './RequestAcceptedMessage'
import type { RequestAcceptedWitnessedMessage } from './RequestAcceptedWitnessedMessage'
import type { RequestMessage } from './RequestMessage'
import type { RequestWitnessedMessage } from './RequestWitnessedMessage'

export * from './CashAcceptedMessage'
export * from './CashAcceptedWitnessedMessage'
export * from './CashRemovedMessage'
export * from './RequestMessage'
export * from './RequestWitnessedMessage'
export * from './RequestAcceptedMessage'
export * from './RequestAcceptedWitnessedMessage'
export * from './GetterReceiptMessage'
export * from './GiverReceiptMessage'
export * from './ProblemReportMessage'

export type ValueTransferMessage =
  | CashAcceptedMessage
  | CashAcceptedWitnessedMessage
  | CashRemovedMessage
  | RequestMessage
  | RequestWitnessedMessage
  | RequestAcceptedMessage
  | RequestAcceptedWitnessedMessage
  | ProblemReportMessage
  | GiverReceiptMessage
  | GetterReceiptMessage
  | GiverReceiptMessage
