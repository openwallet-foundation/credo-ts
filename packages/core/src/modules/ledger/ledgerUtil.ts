import type * as Indy from 'indy-sdk'

export function isLedgerRejectResponse(response: Indy.LedgerResponse): response is Indy.LedgerRejectResponse {
  return response.op === 'REJECT'
}
