import type { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import type { ShareContactStateChangedEvent } from '../ConnectionEvents'

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
import { ShareContactEventTypes } from '../ConnectionEvents'
import { ShareContactRequestMessage, ShareContactResponseMessage, ShareContactResult } from '../messages'
import { ShareContactState } from '../models'

@injectable()
export class ShareContactService {
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

  public async sendShareContactRequest(to: string, invitationId: string): Promise<ShareContactRequestMessage> {
    const id = v4()
    this.config.logger.info(`   > Sending Share Contact message with id ${id} to did ${to}`)

    const did = await this.didService.findStaticDid(DidMarker.Public)
    if (!did) {
      throw new AriesFrameworkError('   < Error on sending Share Contact message: Public Did is not found!')
    }

    const message = new ShareContactRequestMessage({
      from: did.did,
      to: to,
      pthid: invitationId,
      body: {},
    })

    await this.messageSender.sendDIDCommV2Message(message)

    this.config.logger.info(`   < Sending Share Contact message with id ${id} completed!`)
    return message
  }

  public async acceptContact(contactDid: string, threadId: string) {
    await this.didService.storeRemoteDid({ did: contactDid })
    return this.sendShareContactResponse({ to: contactDid, threadId: threadId, result: ShareContactResult.Accepted })
  }

  public async declineContact(contactDid: string, threadId: string) {
    return this.sendShareContactResponse({ to: contactDid, threadId, result: ShareContactResult.Declined })
  }

  public async sendShareContactResponse({
    to,
    threadId,
    result,
  }: {
    to: string
    threadId?: string
    result: ShareContactResult
  }): Promise<ShareContactResponseMessage> {
    this.config.logger.info(`   > Sending Share Contact response with threadId $${threadId} to did $${to}`)

    const did = await this.didService.findStaticDid(DidMarker.Public)
    if (!did) {
      throw new AriesFrameworkError('   < Error on sending Share Contact response: Public Did is not found!')
    }

    const responseMessage = new ShareContactResponseMessage({
      from: did.did,
      to,
      thid: threadId,
      body: {
        result,
      },
    })

    await this.messageSender.sendDIDCommV2Message(responseMessage)

    this.config.logger.info(`   < Sending Share Contact response with threadId $${threadId} completed!`)
    return responseMessage
  }

  public async receiveShareContactRequest(inboundMessage: InboundMessageContext<ShareContactRequestMessage>) {
    const { message } = inboundMessage

    this.eventEmitter.emit<ShareContactStateChangedEvent>({
      type: ShareContactEventTypes.ShareContactStateChanged,
      payload: {
        request: {
          contactDid: message.from,
          state: ShareContactState.Received,
          thid: message.id,
        },
      },
    })

    this.config.logger.info(`   < Received Share Contact message with id $${message.id}`)
  }

  public async receiveShareContactResponse(inboundMessage: InboundMessageContext<ShareContactResponseMessage>) {
    const { message } = inboundMessage

    this.eventEmitter.emit<ShareContactStateChangedEvent>({
      type: ShareContactEventTypes.ShareContactStateChanged,
      payload: {
        request: {
          contactDid: message.from,
          state:
            message.body.result === ShareContactResult.Accepted
              ? ShareContactState.Accepted
              : ShareContactState.Declined,
          thid: message.thid ?? message.id,
        },
      },
    })

    this.config.logger.info(`   < Received Share Did response with threadId $${message.thid}`)
  }

  public async awaitShareContactCompleted(id: string, timeoutMs = 20000): Promise<ShareContactStateChangedEvent> {
    const observable = this.eventEmitter.observable<ShareContactStateChangedEvent>(
      ShareContactEventTypes.ShareContactStateChanged
    )
    const subject = new ReplaySubject<ShareContactStateChangedEvent>(1)

    observable
      .pipe(
        first((event) => {
          const request = event.payload.request
          return (
            request.thid === id &&
            (request.state === ShareContactState.Accepted || request.state === ShareContactState.Declined)
          )
        }),
        timeout(timeoutMs)
      )
      .subscribe(subject)

    return firstValueFrom(subject)
  }
}
