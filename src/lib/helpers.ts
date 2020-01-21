import { InvitationDetails } from './protocols/connections/domain/InvitationDetails';
import { injectable } from 'inversify';

export function decodeInvitationFromUrl(invitationUrl: string) {
  const [, encodedInvitation] = invitationUrl.split('c_i=');
  const invitation = JSON.parse(Buffer.from(encodedInvitation, 'base64').toString());
  return invitation;
}

export function encodeInvitationToUrl(invitation: InvitationDetails): string {
  const encodedInvitation = Buffer.from(JSON.stringify(invitation)).toString('base64');
  const invitationUrl = `https://example.com/ssi?c_i=${encodedInvitation}`;
  return invitationUrl;
}

@injectable()
export class Poller {
  private forceStopped: boolean = false;

  async poll(fn: Function, fnCondition: Function, ms: number = 1000) {
    let result = await fn();
    while (fnCondition(result)) {
      await new Promise(r => setTimeout(r, ms));
      if (this.forceStopped) {
        break;
      }
      result = await fn();
      if (this.forceStopped) {
        break;
      }
    }
    return result;
  }

  stop() {
    this.forceStopped = true;
  }
}
