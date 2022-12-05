import type { DecryptedMessageContext, EncryptedMessage, SignedMessage } from '../didcomm/types'
import type { DidCommV1Message, PackMessageParams as DidCommV1PackMessageParams } from '../didcomm/versions/v1'
import type {
  DidCommV2EnvelopeService,
  DidCommV2Message,
  V2PackMessageParams as DidCommV2PackMessageParams,
} from '../didcomm/versions/v2'
import type { AgentMessage } from './AgentMessage'
import type { AgentContext } from './context'

import { isEncryptedMessage, isSignedMessage } from '../didcomm'
import { DidCommMessageVersion } from '../didcomm/types'
import { DidCommV1EnvelopeService, DidCommV1EnvelopeServiceToken } from '../didcomm/versions/v1'
import { isDidCommV1EncryptedEnvelope } from '../didcomm/versions/v1/helpers'
import { DefaultDidCommV2EnvelopeService, DidCommV2EnvelopeServiceToken } from '../didcomm/versions/v2'
import { AriesFrameworkError } from '../error'
import { inject, injectable } from '../plugins'

export type PackMessageParams = DidCommV1PackMessageParams | DidCommV2PackMessageParams

@injectable()
export class EnvelopeService {
  private didCommV1EnvelopeService: DidCommV1EnvelopeService
  private didCommV2EnvelopeService: DidCommV2EnvelopeService | typeof DefaultDidCommV2EnvelopeService

  public constructor(
    @inject(DidCommV1EnvelopeServiceToken) didCommV1EnvelopeService: DidCommV1EnvelopeService,
    @inject(DidCommV2EnvelopeServiceToken)
    didCommV2EnvelopeService: DidCommV2EnvelopeService | typeof DefaultDidCommV2EnvelopeService
  ) {
    this.didCommV1EnvelopeService = didCommV1EnvelopeService
    this.didCommV2EnvelopeService = didCommV2EnvelopeService
  }

  private getDidCommV2EnvelopeService(): DidCommV2EnvelopeService {
    if (this.didCommV2EnvelopeService === DefaultDidCommV2EnvelopeService) {
      throw new AriesFrameworkError('Unable to resolve DidCommV2EnvelopeService')
    }
    return this.didCommV2EnvelopeService
  }

  public async packMessage(
    agentContext: AgentContext,
    message: AgentMessage,
    params: PackMessageParams
  ): Promise<EncryptedMessage> {
    if (message.didCommVersion === DidCommMessageVersion.V1) {
      return this.didCommV1EnvelopeService.packMessage(
        agentContext,
        message as DidCommV1Message,
        params as DidCommV1PackMessageParams
      )
    }
    if (message.didCommVersion === DidCommMessageVersion.V2) {
      return this.getDidCommV2EnvelopeService().packMessage(
        agentContext,
        message as DidCommV2Message,
        params as DidCommV2PackMessageParams
      )
    }
    throw new AriesFrameworkError(`Unexpected pack DIDComm message params: ${params}`)
  }

  public async unpackMessage(
    agentContext: AgentContext,
    message: EncryptedMessage | SignedMessage
  ): Promise<DecryptedMessageContext> {
    if (isEncryptedMessage(message)) {
      return this.unpackJwe(agentContext, message)
    }
    if (isSignedMessage(message)) {
      return this.unpackJws(agentContext, message)
    }
    throw new AriesFrameworkError(`Unexpected message!`)
  }

  private async unpackJwe(agentContext: AgentContext, message: EncryptedMessage): Promise<DecryptedMessageContext> {
    if (isDidCommV1EncryptedEnvelope(message)) {
      return this.didCommV1EnvelopeService.unpackMessage(agentContext, message)
    } else {
      return this.getDidCommV2EnvelopeService().unpackMessage(agentContext, message)
    }
  }

  private async unpackJws(agentContext: AgentContext, message: SignedMessage): Promise<DecryptedMessageContext> {
    return this.getDidCommV2EnvelopeService().unpackMessage(agentContext, message)
  }
}
