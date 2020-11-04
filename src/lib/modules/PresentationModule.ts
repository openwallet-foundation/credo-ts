import { ConnectionRecord } from '../storage/ConnectionRecord';
import { createOutboundMessage } from '../protocols/helpers';
import { MessageSender } from '../agent/MessageSender';
import { presenationRequestTemplate, PresentationService } from '../protocols/presentproof/PresentationService';

export class ProofsModule {
  private presentationService: PresentationService;
  private messageSender: MessageSender;

  public constructor(
    presentationService: PresentationService,
    messageSender: MessageSender
  ) {
    this.presentationService = presentationService;
    this.messageSender = messageSender;
  }

  public async createPresentation(connection: ConnectionRecord, proofPresentationMessage: presenationRequestTemplate ) {
    const presentationRequestMessage = await this.presentationService.createPresentationRequest(connection, proofPresentationMessage);
    const outboundMessage = createOutboundMessage(connection, presentationRequestMessage);
    await this.messageSender.sendMessage(outboundMessage);
  }

}
