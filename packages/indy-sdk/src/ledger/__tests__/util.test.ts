import type { LedgerRejectResponse, LedgerReqnackResponse } from 'indy-sdk'

import * as LedgerUtil from '../util'

describe('LedgerUtils', () => {
  // IsLedgerRejectResponse
  it('Should return true if the response op is: REJECT', () => {
    const ledgerResponse: LedgerRejectResponse = {
      op: 'REJECT',
      reqId: 1,
      reason: 'Why not',
      identifier: '123456',
    }
    expect(LedgerUtil.isLedgerRejectResponse(ledgerResponse)).toEqual(true)
  })
  it('Should return false if the response op is not: REJECT', () => {
    const ledgerResponse: LedgerReqnackResponse = {
      op: 'REQNACK',
      reqId: 1,
      reason: 'Why not',
      identifier: '123456',
    }
    expect(LedgerUtil.isLedgerRejectResponse(ledgerResponse)).toEqual(false)
  })

  // isLedgerReqnackResponse
  it('Should return true if the response op is: REQNACK', () => {
    const ledgerResponse: LedgerReqnackResponse = {
      op: 'REQNACK',
      reqId: 1,
      reason: 'Why not',
      identifier: '123456',
    }
    expect(LedgerUtil.isLedgerReqnackResponse(ledgerResponse)).toEqual(true)
  })
  it('Should return false if the response op is NOT: REQNACK', () => {
    const ledgerResponse: LedgerRejectResponse = {
      op: 'REJECT',
      reqId: 1,
      reason: 'Why not',
      identifier: '123456',
    }
    expect(LedgerUtil.isLedgerReqnackResponse(ledgerResponse)).toEqual(false)
  })
})
