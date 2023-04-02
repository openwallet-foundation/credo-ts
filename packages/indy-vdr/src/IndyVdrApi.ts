import type { Key } from '@aries-framework/core'
import type { IndyVdrRequest } from '@hyperledger/indy-vdr-shared'

import { AgentContext, injectable, TypedArrayEncoder } from '@aries-framework/core'
import { CustomRequest } from '@hyperledger/indy-vdr-shared'

import { verificationKeyForIndyDid, parseIndyDid } from './dids/didIndyUtil'
import { IndyVdrError } from './error'

@injectable()
export class IndyVdrApi {
  private agentContext: AgentContext

  public constructor(agentContext: AgentContext) {
    this.agentContext = agentContext
  }

  private async multiSignRequest<Request extends IndyVdrRequest>(
    request: Request,
    signingKey: Key,
    identifier: string
  ) {
    const signature = await this.agentContext.wallet.sign({
      data: TypedArrayEncoder.fromString(request.signatureInput),
      key: signingKey,
    })

    request.setMultiSignature({
      signature,
      identifier,
    })

    return request
  }

  private async signRequest<Request extends IndyVdrRequest>(request: Request, submitterDid: string) {
    const signingKey = await verificationKeyForIndyDid(this.agentContext, submitterDid)

    const signature = await this.agentContext.wallet.sign({
      data: TypedArrayEncoder.fromString(request.signatureInput),
      key: signingKey,
    })

    request.setSignature({
      signature,
    })

    return request
  }

  public async endorseTransaction<Request extends IndyVdrRequest>(transaction: Request, endorserDid: string) {
    const endorserSigningKey = await verificationKeyForIndyDid(this.agentContext, endorserDid)
    const { namespaceIdentifier } = parseIndyDid(endorserDid)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const request = new CustomRequest({ customRequest: transaction.body as any })
    let endorsedTransaction: CustomRequest

    // the request is not parsed correctly. The reqId overflows.
    const txBody = JSON.parse(transaction.body)
    if (txBody.signature) {
      if (txBody.endorser !== namespaceIdentifier) throw new IndyVdrError('Submitter does not match Endorser')
      endorsedTransaction = await this.multiSignRequest(request, endorserSigningKey, namespaceIdentifier)
    } else {
      if (txBody.identifier !== namespaceIdentifier) throw new IndyVdrError('Submitter does not match identifier')
      endorsedTransaction = await this.signRequest(request, endorserDid)
    }
    return endorsedTransaction
  }
}
