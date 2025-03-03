import type { AgentContext, Key } from '@credo-ts/core'
import type { IndyVdrRequest } from '@hyperledger/indy-vdr-shared'
import type { IndyVdrPool } from '../pool'

import { TypedArrayEncoder } from '@credo-ts/core'

import { verificationKeyForIndyDid } from '../dids/didIndyUtil'

export async function multiSignRequest<Request extends IndyVdrRequest>(
  agentContext: AgentContext,
  request: Request,
  signingKey: Key,
  identifier: string
) {
  const signature = await agentContext.wallet.sign({
    data: TypedArrayEncoder.fromString(request.signatureInput),
    key: signingKey,
  })

  request.setMultiSignature({
    signature,
    identifier,
  })

  return request
}

export async function signRequest<Request extends IndyVdrRequest>(
  agentContext: AgentContext,
  pool: IndyVdrPool,
  request: Request,
  submitterDid: string
) {
  const signingKey = await verificationKeyForIndyDid(agentContext, submitterDid)
  const signedRequest = await pool.prepareWriteRequest(agentContext, request, signingKey)

  return signedRequest
}
