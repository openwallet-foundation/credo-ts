import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { TrustPingReceivedEvent } from '../ConnectionEvents'
import type { TrustPingMessage } from '../messages'
import type { ConnectionRecord } from '../repository/ConnectionRecord'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { first, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'
import { v4 } from 'uuid'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { MessageSender } from '../../../agent/MessageSender'
import { createOutboundMessage } from '../../../agent/helpers'
import { DidMarker } from '../../dids/domain/Did'
import { DidService } from '../../dids/services/DidService'
import { TrustPingEventTypes } from '../ConnectionEvents'
import { TrustPingResponseMessage, TrustPingResponseMessageV2, TrustPingMessageV2 } from '../messages'

@scoped(Lifecycle.ContainerScoped)
export class TrustPingService {
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

  public processPing({ message }: InboundMessageContext<TrustPingMessage>, connection: ConnectionRecord) {
    if (message.responseRequested) {
      const response = new TrustPingResponseMessage({
        threadId: message.id,
      })

      return createOutboundMessage(connection, response)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public processPingResponse(inboundMessage: InboundMessageContext<TrustPingResponseMessage>) {
    // TODO: handle ping response message
  }

  public async sendTrustPing(to: string, responseRequested = true): Promise<TrustPingMessageV2> {
    const id = v4()
    this.config.logger.info(`   > Sending Trust Ping message with id ${id} to did ${to}`)

    const did = await this.didService.findStaticDid(DidMarker.Queries)

    const message = new TrustPingMessageV2({
      from: did?.did,
      to: to,
      body: { responseRequested },
    })

    await this.messageSender.sendDIDCommV2Message(message)

    this.config.logger.info(`   < Sending Trust Ping message with id ${id} completed!`)
    return message
  }

  public async processTrustPingV2(inboundMessage: InboundMessageContext<TrustPingMessageV2>) {
    this.config.logger.info(`   > Process Trust Ping message with id $${inboundMessage.message.id}`)
    const { message: ping } = inboundMessage

    if (!ping.body.responseRequested) {
      this.config.logger.info(
        `   < Process Trust Ping message with id $${inboundMessage.message.id} completed! No response requested.`
      )
      return
    }

    if (!ping.from) {
      this.config.logger.info('    Unknown Trust Ping sender')
      return
    }

    const did = await this.didService.findStaticDid(DidMarker.Queries)

    const message = new TrustPingResponseMessageV2({
      from: did?.did,
      to: ping.from,
      thid: ping.id,
    })

    await this.messageSender.sendDIDCommV2Message(message)

    this.config.logger.info(`   < Process Trust Ping message with id $${inboundMessage.message.id} completed!`)
  }

  public processTrustPingResponseV2(inboundMessage: InboundMessageContext<TrustPingResponseMessageV2>) {
    this.config.logger.info(`   > Process Trust Ping Response message with thid $${inboundMessage.message.thid}`)
    const { message: pingResponse } = inboundMessage

    this.eventEmitter.emit<TrustPingReceivedEvent>({
      type: TrustPingEventTypes.TrustPingResponseReceived,
      payload: {
        thid: pingResponse.thid,
      },
    })

    this.config.logger.info(
      `   < Process Trust Ping Response message with thid $${inboundMessage.message.thid} completed!`
    )
  }

  public async awaitTrustPingResponse(id: string, timeoutMs = 20000): Promise<TrustPingReceivedEvent> {
    const observable = this.eventEmitter.observable<TrustPingReceivedEvent>(
      TrustPingEventTypes.TrustPingResponseReceived
    )
    const subject = new ReplaySubject<TrustPingReceivedEvent>(1)

    observable
      .pipe(
        first((event) => id === event.payload.thid),
        timeout(timeoutMs)
      )
      .subscribe(subject)

    return firstValueFrom(subject)
  }
}
