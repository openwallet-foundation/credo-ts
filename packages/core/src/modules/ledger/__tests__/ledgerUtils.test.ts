import type { LedgerRejectResponse, LedgerReqnackResponse } from 'indy-sdk'

import * as LedgerUtil from '../ledgerUtil'

describe('LedgerUtils', () => {
  // IsLedgerRejectResponse
  it('Should return true if the response op is: REJECT', () => {
    const ledgerResponse = {
      op: 'REJECT',
      reqId: 1,
      reason: 'Why not',
      identifier: '123456',
    } as LedgerRejectResponse
    expect(LedgerUtil.isLedgerRejectResponse(ledgerResponse)).toEqual(true)
  })
  it('Should return false if the response op is not: REJECT', () => {
    const ledgerResponse = {
      op: 'REQNACK',
      reqId: 1,
      reason: 'Why not',
      identifier: '123456',
    } as LedgerReqnackResponse
    expect(LedgerUtil.isLedgerRejectResponse(ledgerResponse)).toEqual(false)
  })

  // isLedgerReqnackResponse
  it('Should return true if the response op is: REQNACK', () => {
    const ledgerResponse = {
      op: 'REQNACK',
      reqId: 1,
      reason: 'Why not',
      identifier: '123456',
    } as LedgerReqnackResponse
    expect(LedgerUtil.isLedgerReqnackResponse(ledgerResponse)).toEqual(true)
  })
  it('Should return false if the response op is NOT: REQNACK', () => {
    const ledgerResponse = {
      op: 'REJECT',
      reqId: 1,
      reason: 'Why not',
      identifier: '123456',
    } as LedgerRejectResponse
    expect(LedgerUtil.isLedgerReqnackResponse(ledgerResponse)).toEqual(false)
  })

  // generateSchemaId
  it('Should return a valid schema ID given did name and version', () => {
    const did = '12345',
      name = 'backbench',
      version = '420'
    expect(LedgerUtil.generateSchemaId(did, name, version)).toEqual('12345:2:backbench:420')
  })

  // generateCredentialDefinitionId
  it('Should return a valid schema ID given did name and version', () => {
    const did = '12345',
      seqNo = 420,
      tag = 'someTag'
    expect(LedgerUtil.generateCredentialDefinitionId(did, seqNo, tag)).toEqual('12345:3:CL:420:someTag')
  })
})
