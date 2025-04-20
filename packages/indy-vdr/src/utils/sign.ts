import { AgentContext, Kms } from '@credo-ts/core'
import type { IndyVdrRequest } from '@hyperledger/indy-vdr-shared'
import type { IndyVdrPool } from '../pool'

import { TypedArrayEncoder } from '@credo-ts/core'

import { verificationPublicJwkForIndyDid } from '../dids/didIndyUtil'

export async function multiSignRequest<Request extends IndyVdrRequest>(
  agentContext: AgentContext,
  request: Request,
  signingKey: Kms.PublicJwk<Kms.Ed25519PublicJwk>,
  identifier: string
) {
  const kms = agentContext.dependencyManager.resolve(Kms.KeyManagementApi)
  const { signature } = await kms.sign({
    data: TypedArrayEncoder.fromString(request.signatureInput),
    algorithm: 'EdDSA',
    keyId: signingKey.keyId,
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
  const signingKey = await verificationPublicJwkForIndyDid(agentContext, submitterDid)
  const signedRequest = await pool.prepareWriteRequest(agentContext, request, signingKey)

  return signedRequest
}
