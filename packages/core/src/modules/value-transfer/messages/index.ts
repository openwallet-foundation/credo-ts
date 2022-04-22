import { CashAcceptedMessage } from "./CashAcceptedMessage"
import { CashRemovedMessage } from "./CashRemovedMessage"
import { RequestMessage } from "./RequestMessage"
import { RequestAcceptedMessage } from "./RequestAcceptedMessage"
import { GiverRejectMessage } from "./GiverRejectMessage"
import { GetterRejectMessage } from "./GetterRejectMessage"
import { ReceiptMessage } from "./ReceiptMessage"
import { WitnessRejectMessage } from "./WitnessRejectMessage"

export * from "./CashAcceptedMessage"
export * from "./CashRemovedMessage"
export * from "./GiverRejectMessage"
export * from "./GetterRejectMessage"
export * from "./RequestMessage"
export * from "./RequestAcceptedMessage"
export * from "./ReceiptMessage"
export * from "./WitnessRejectMessage"

export type ValueTransferMessage =
    | CashAcceptedMessage
    | CashRemovedMessage
    | RequestMessage
    | RequestAcceptedMessage
    | GetterRejectMessage
    | GiverRejectMessage
    | ReceiptMessage
    | WitnessRejectMessage
