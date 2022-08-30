import type * as Indy from 'indy-sdk'

export function isLedgerRejectResponse(response: Indy.LedgerResponse): response is Indy.LedgerRejectResponse {
  return response.op === 'REJECT'
}

export function isLedgerReqnackResponse(response: Indy.LedgerResponse): response is Indy.LedgerReqnackResponse {
  return response.op === 'REQNACK'
}

export function generateSchemaId(did: string, name: string, version: string) {
  return `${did}:2:${name}:${version}`
}

export function generateCredentialDefinitionId(did: string, seqNo: number, tag: string) {
  return `${did}:3:CL:${seqNo}:${tag}`
}
