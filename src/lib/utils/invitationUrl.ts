import { validateOrReject } from 'class-validator';

import { ConnectionInvitationMessage } from '../protocols/connections/ConnectionInvitationMessage';
import { MessageTransformer } from '../agent/MessageTransformer';

/**
 * Create a `ConnectionInvitationMessage` instance from the `c_i` parameter of an URL
 *
 * @param invitationUrl invitation url containing c_i parameter
 *
 * @throws Error when url can not be decoded to JSON, or decoded message is not a valid `ConnectionInvitationMessage`
 */
export async function decodeInvitationFromUrl(invitationUrl: string): Promise<ConnectionInvitationMessage> {
  // TODO: properly extract c_i param from invitation URL
  const [, encodedInvitation] = invitationUrl.split('c_i=');
  const invitationJson: object = JSON.parse(Buffer.from(encodedInvitation, 'base64').toString());

  const invitation = MessageTransformer.toMessageInstance(invitationJson, ConnectionInvitationMessage);

  // TODO: should validation happen here?
  await validateOrReject(invitation);

  return invitation;
}

/**
 * Create an invitation url from this instance
 *
 * @param invitation invitation message
 * @param domain domain name to use for invitation url
 */
export function encodeInvitationToUrl(
  invitation: ConnectionInvitationMessage,
  domain: string = 'https://example.com/ssi'
): string {
  const invitationJson = MessageTransformer.toJSON(invitation);
  const stringifiedInvitation = JSON.stringify(invitationJson);
  const encodedInvitation = Buffer.from(stringifiedInvitation).toString('base64');
  const invitationUrl = `${domain}?c_i=${encodedInvitation}`;

  return invitationUrl;
}
