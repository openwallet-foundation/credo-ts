import { parseUrl } from 'query-string'

import { AriesFrameworkError } from '../error'
import { ConnectionInvitationMessage } from '../modules/connections'
import { convertToNewInvitation } from '../modules/oob/helpers'
import { OutOfBandInvitation } from '../modules/oob/messages'

/**
 * Parses URL containing encoded invitation and returns invitation message.
 *
 * @param invitationUrl URL containing encoded invitation
 *
 * @returns OutOfBandInvitation
 */
export const parseInvitationUrl = async (invitationUrl: string): Promise<OutOfBandInvitation> => {
  const parsedUrl = parseUrl(invitationUrl).query
  if (parsedUrl['oob']) {
    const outOfBandInvitation = await OutOfBandInvitation.fromUrl(invitationUrl)
    return outOfBandInvitation
  } else if (parsedUrl['c_i'] || parsedUrl['d_m']) {
    const invitation = await ConnectionInvitationMessage.fromUrl(invitationUrl)
    return convertToNewInvitation(invitation)
  }
  throw new AriesFrameworkError(
    'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters: `oob`, `c_i` or `d_m`.'
  )
}
