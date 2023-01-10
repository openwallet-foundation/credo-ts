import type { LedgerResponse, LedgerRejectResponse, LedgerReqnackResponse } from 'indy-sdk'

export function isLedgerRejectResponse(response: LedgerResponse): response is LedgerRejectResponse {
  return response.op === 'REJECT'
}

export function isLedgerReqnackResponse(response: LedgerResponse): response is LedgerReqnackResponse {
  return response.op === 'REQNACK'
}
