import type { DIDCommV1Message } from './v1/DIDCommV1Message'
import type { DIDCommV2Message } from './v2/DIDCommV2Message'

export type DIDCommMessage = DIDCommV1Message | DIDCommV2Message
