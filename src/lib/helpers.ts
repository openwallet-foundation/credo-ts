import { InvitationDetails } from './types';

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
