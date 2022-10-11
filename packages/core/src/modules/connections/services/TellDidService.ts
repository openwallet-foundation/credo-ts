import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { TellDidMessageReceivedEvent, TellDidResponseReceivedEvent } from '../ConnectionEvents'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, timeout } from 'rxjs/operators'
import { v4 } from 'uuid'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { AriesFrameworkError } from '../../../error'
import { injectable } from '../../../plugins'
import { DidMarker } from '../../dids/domain/Did'
import { DidService } from '../../dids/services/DidService'
import { TellDidEventTypes } from '../ConnectionEvents'
import { TellDidResult, TellDidMessage, TellDidResponseMessage } from '../messages'

@injectable()
export class TellDidService {
  private config: AgentConfig
  private didService: DidService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter

  public constructor(
    config: AgentConfig,
    didService: DidService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.config = config
    this.didService = didService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
  }

  public async sendTellDidMessage(to: string, parentThreadId?: string): Promise<TellDidMessage> {
    const id = v4()
    this.config.logger.info(`   > Sending Tell Did message with id ${id} to did ${to}`)

    const did = await this.didService.findStaticDid(DidMarker.Public)
    if (!did) {
      throw new AriesFrameworkError('   < Error on sending Tell Did message: Public Did is not found!')
    }

    const message = new TellDidMessage({
      from: did.did,
      to: to,
      pthid: parentThreadId,
      body: { did: did.did },
    })

    await this.messageSender.sendDIDCommV2Message(message)

    this.config.logger.info(`   < Sending Tell Did message with id ${id} completed!`)
    return message
  }

  public async acceptRemoteDid(message: TellDidMessage) {
    await this.didService.storeRemoteDid(message.body)
    return this.sendTellDidResponse({ to: message.from, threadId: message.thid, result: TellDidResult.Accepted })
  }

  public async declineRemoteDid(message: TellDidMessage) {
    return this.sendTellDidResponse({ to: message.from, threadId: message.thid, result: TellDidResult.Declined })
  }

  public async sendTellDidResponse({
    to,
    threadId,
    result,
  }: {
    to: string
    threadId?: string
    result: TellDidResult
  }): Promise<TellDidResponseMessage> {
    this.config.logger.info(`   > Sending Tell Did message with thid $${to} to threadId $${threadId}`)

    const did = await this.didService.findStaticDid(DidMarker.Public)
    if (!did) {
      throw new AriesFrameworkError('   < Error on processing Tell Did message: Public Did is not found!')
    }

    const responseMessage = new TellDidResponseMessage({
      from: did.did,
      to,
      thid: threadId,
      body: {
        result,
      },
    })

    await this.messageSender.sendDIDCommV2Message(responseMessage)

    this.config.logger.info(`   < Process Tell Did message with threadId $${threadId} completed!`)
    return responseMessage
  }

  public async receiveTellDidMessage(inboundMessage: InboundMessageContext<TellDidMessage>) {
    const { message } = inboundMessage

    this.eventEmitter.emit<TellDidMessageReceivedEvent>({
      type: TellDidEventTypes.TellDidMessageReceived,
      payload: {
        message,
      },
    })

    this.config.logger.info(`   < Received Tell Did message with id $${message.id}`)
  }

  public async receiveTellDidResponse(inboundMessage: InboundMessageContext<TellDidResponseMessage>) {
    const { message } = inboundMessage

    this.eventEmitter.emit<TellDidResponseReceivedEvent>({
      type: TellDidEventTypes.TellDidResponseReceived,
      payload: {
        message,
      },
    })

    this.config.logger.info(`   < Received Tell Did response with threadId $${message.thid}`)
  }

  public async awaitTellDidResponse(id: string, timeoutMs = 20000): Promise<TellDidResponseReceivedEvent> {
    const observable = this.eventEmitter.observable<TellDidResponseReceivedEvent>(
      TellDidEventTypes.TellDidResponseReceived
    )
    const subject = new ReplaySubject<TellDidResponseReceivedEvent>(1)

    observable
      .pipe(
        first((event) => id === event.payload.message.thid),
        timeout(timeoutMs)
      )
      .subscribe(subject)

    return firstValueFrom(subject)
  }
}
