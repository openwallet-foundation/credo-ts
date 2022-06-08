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
  try {
    const outOfBandInvitation = await OutOfBandInvitation.fromUrl(invitationUrl)
    return outOfBandInvitation
  } catch (error) {
    const invitation = await ConnectionInvitationMessage.fromUrl(invitationUrl)
    return convertToNewInvitation(invitation)
  }
}
