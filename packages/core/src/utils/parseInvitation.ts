import type { AgentDependencies } from '../agent/AgentDependencies'
import type { Response } from 'node-fetch'

import { AbortController } from 'abort-controller'
import { parseUrl } from 'query-string'

import { AgentMessage } from '../agent/AgentMessage'
import { AriesFrameworkError } from '../error'
import { ConnectionInvitationMessage } from '../modules/connections'
import { OutOfBandDidCommService } from '../modules/oob/domain/OutOfBandDidCommService'
import { convertToNewInvitation } from '../modules/oob/helpers'
import { InvitationType, OutOfBandInvitation } from '../modules/oob/messages'

import { JsonEncoder } from './JsonEncoder'
import { JsonTransformer } from './JsonTransformer'
import { MessageValidator } from './MessageValidator'
import { parseMessageType, supportsIncomingMessageType } from './messageType'

const fetchShortUrl = async (invitationUrl: string, dependencies: AgentDependencies) => {
  const abortController = new AbortController()
  const id = setTimeout(() => abortController.abort(), 15000)
  let response
  try {
    response = await dependencies.fetch(invitationUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    throw new AriesFrameworkError(`Get request failed on provided url: ${error.message}`, { cause: error })
  }
  clearTimeout(id)
  return response
}

/**
 * Parses URL containing encoded invitation and returns invitation message.
 *
 * @param invitationUrl URL containing encoded invitation
 *
 * @returns OutOfBandInvitation
 */
export const parseInvitationUrl = (invitationUrl: string): OutOfBandInvitation => {
  const parsedUrl = parseUrl(invitationUrl).query
  if (parsedUrl['oob']) {
    const outOfBandInvitation = OutOfBandInvitation.fromUrl(invitationUrl)
    return outOfBandInvitation
  } else if (parsedUrl['c_i'] || parsedUrl['d_m']) {
    const invitation = ConnectionInvitationMessage.fromUrl(invitationUrl)
    return convertToNewInvitation(invitation)
  }
  throw new AriesFrameworkError(
    'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters: `oob`, `c_i` or `d_m`.'
  )
}

// This currently does not follow the RFC because of issues with fetch, currently uses a janky work around
export const oobInvitationFromShortUrl = async (response: Response): Promise<OutOfBandInvitation> => {
  if (response) {
    if (response.headers.get('Content-Type')?.startsWith('application/json') && response.ok) {
      const invitationJson = await response.json()
      const parsedMessageType = parseMessageType(invitationJson['@type'])
      if (supportsIncomingMessageType(parsedMessageType, OutOfBandInvitation.type)) {
        const invitation = JsonTransformer.fromJSON(invitationJson, OutOfBandInvitation)
        MessageValidator.validateSync(invitation)
        return invitation
      } else if (supportsIncomingMessageType(parsedMessageType, ConnectionInvitationMessage.type)) {
        const invitation = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)
        MessageValidator.validateSync(invitation)
        return convertToNewInvitation(invitation)
      } else {
        throw new AriesFrameworkError(`Invitation with '@type' ${parsedMessageType.messageTypeUri} not supported.`)
      }
    } else if (response['url']) {
      // The following if else is for here for trinsic shorten urls
      // Because the redirect targets a deep link the automatic redirect does not occur
      let responseUrl
      const location = response.headers.get('Location')
      if ((response.status === 302 || response.status === 301) && location) responseUrl = location
      else responseUrl = response['url']

      return parseInvitationUrl(responseUrl)
    }
  }
  throw new AriesFrameworkError('HTTP request time out or did not receive valid response')
}

/**
 * Parses URL containing encoded invitation and returns invitation message. Compatible with
 * parsing short Urls
 *
 * @param invitationUrl URL containing encoded invitation
 *
 * @param dependencies Agent dependencies containing fetch
 *
 * @returns OutOfBandInvitation
 */
export const parseInvitationShortUrl = async (
  invitationUrl: string,
  dependencies: AgentDependencies
): Promise<OutOfBandInvitation> => {
  const parsedUrl = parseUrl(invitationUrl).query
  if (parsedUrl['oob']) {
    const outOfBandInvitation = OutOfBandInvitation.fromUrl(invitationUrl)
    outOfBandInvitation.invitationType = InvitationType.OutOfBand
    return outOfBandInvitation
  } else if (parsedUrl['c_i']) {
    const invitation = ConnectionInvitationMessage.fromUrl(invitationUrl)
    const outOfBandInvitation = convertToNewInvitation(invitation)
    outOfBandInvitation.invitationType = InvitationType.Connection
    return outOfBandInvitation
  }
  // Legacy connectionless invitation
  else if (parsedUrl['d_m']) {
    const messageJson = JsonEncoder.fromBase64(parsedUrl['d_m'] as string)
    const agentMessage = JsonTransformer.fromJSON(messageJson, AgentMessage)

    // ~service is required for legacy connectionless invitations
    if (!agentMessage.service) {
      throw new AriesFrameworkError('Invalid legacy connectionless invitation url. Missing ~service decorator.')
    }

    // This destructuring removes the ~service property from the message, and
    // we can can use messageWithoutService to create the out of band invitation
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { '~service': service, ...messageWithoutService } = messageJson

    // transform into out of band invitation
    const invitation = new OutOfBandInvitation({
      // The label is currently required by the OutOfBandInvitation class, but not according to the specification.
      // FIXME: In 0.5.0 we will make this optional: https://github.com/hyperledger/aries-framework-javascript/issues/1524
      label: '',
      services: [OutOfBandDidCommService.fromResolvedDidCommService(agentMessage.service.resolvedDidCommService)],
    })

    invitation.invitationType = InvitationType.Connectionless
    invitation.addRequest(JsonTransformer.fromJSON(messageWithoutService, AgentMessage))

    return invitation
  } else {
    try {
      const outOfBandInvitation = await oobInvitationFromShortUrl(await fetchShortUrl(invitationUrl, dependencies))
      outOfBandInvitation.invitationType = InvitationType.OutOfBand
      return outOfBandInvitation
    } catch (error) {
      throw new AriesFrameworkError(
        'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters: `oob`, `c_i` or `d_m`, or be valid shortened URL'
      )
    }
  }
}
