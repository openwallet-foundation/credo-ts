import { validateOrReject } from 'class-validator'

import { ConnectionInvitationMessage } from './modules/connections'
import { JsonEncoder } from './utils/JsonEncoder'
import { JsonTransformer } from './utils/JsonTransformer'

/**
 * Create a `ConnectionInvitationMessage` instance from the `c_i` parameter of an URL
 *
 * @param invitationUrl invitation url containing c_i parameter
 *
 * @throws Error when url can not be decoded to JSON, or decoded message is not a valid `ConnectionInvitationMessage`
 */
export async function decodeInvitationFromUrl(invitationUrl: string): Promise<ConnectionInvitationMessage> {
  // TODO: properly extract c_i param from invitation URL
  const [, encodedInvitation] = invitationUrl.split('c_i=')
  const invitationJson = JsonEncoder.fromBase64(encodedInvitation)

  const invitation = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)

  // TODO: should validation happen here?
  await validateOrReject(invitation)

  return invitation
}

/**
 * Create an invitation url from this instance
 *
 * @param invitation invitation message
 * @param domain domain name to use for invitation url
 */
export function encodeInvitationToUrl(
  invitation: ConnectionInvitationMessage,
  domain = 'https://example.com/ssi'
): string {
  const invitationJson = JsonTransformer.toJSON(invitation)
  const encodedInvitation = JsonEncoder.toBase64URL(invitationJson)
  const invitationUrl = `${domain}?c_i=${encodedInvitation}`

  return invitationUrl
}
