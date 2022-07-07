import type { AgentDependencies } from '../agent/AgentDependencies'
import type { Response } from 'node-fetch'

import { parseUrl } from 'query-string'

import { AriesFrameworkError } from '../error'
import { ConnectionInvitationMessage } from '../modules/connections'
import { convertToNewInvitation } from '../modules/oob/helpers'
import { OutOfBandInvitation } from '../modules/oob/messages'

import { JsonEncoder } from './JsonEncoder'
import { JsonTransformer } from './JsonTransformer'
import { MessageValidator } from './MessageValidator'

const fetchShortUrl = async (invitationUrl: string, dependencies: AgentDependencies) => {
  // eslint-disable-next-line no-restricted-globals
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
    throw new AriesFrameworkError('Get request failed on provided Url')
  }
  clearTimeout(id)
  return response
}

//This currently does not follow the RFC because of issues with fetch, currently uses a janky work around
export const fromShortUrl = async (response: Response): Promise<OutOfBandInvitation> => {
  if (response) {
    if (response.headers.get('Content-Type') === 'application/json' && response.ok) {
      const invitationJson = await response.json()
      if (invitationJson['@type'].includes('out-of-band')) {
        const invitation = JsonTransformer.fromJSON(invitationJson, OutOfBandInvitation)

        await MessageValidator.validateSync(invitation)

        return invitation
      } else {
        const invitation = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)

        await MessageValidator.validateSync(invitation)

        return convertToNewInvitation(invitation)
      }
    } else if (response['url']) {
      let parsedUrl
      const location = response.headers.get('Location')
      if (response.status === 302 && location) parsedUrl = parseUrl(location).query
      else parsedUrl = parseUrl(response['url']).query

      if (parsedUrl['oob']) {
        const encodedInvitation = parsedUrl['oob']
        let invitationJson = null
        if (typeof encodedInvitation === 'string') invitationJson = JsonEncoder.fromBase64(encodedInvitation)
        const invitation = JsonTransformer.fromJSON(invitationJson, OutOfBandInvitation)

        await MessageValidator.validateSync(invitation)

        return invitation
      } else {
        if (parsedUrl['c_i'] || parsedUrl['d_m']) {
          const encodedInvitation = parsedUrl['c_i'] ?? parsedUrl['d_m']
          let invitationJson = null
          if (typeof encodedInvitation === 'string') invitationJson = JsonEncoder.fromBase64(encodedInvitation)
          const invitation = JsonTransformer.fromJSON(invitationJson, ConnectionInvitationMessage)

          await MessageValidator.validateSync(invitation)

          return convertToNewInvitation(invitation)
        }
        throw new AriesFrameworkError(
          'InvitationUrl is invalid. Needs to be encrypted with either c_i, d_m, or oob or must be valid shortened URL'
        )
      }
    }
  }
  throw new AriesFrameworkError('HTTP request time out or did not receive valid response')
}

/**
 * Parses URL containing encoded invitation and returns invitation message.
 *
 * @param invitationUrl URL containing encoded invitation
 *
 * @returns OutOfBandInvitation
 */
export const parseInvitationUrl = async (
  invitationUrl: string,
  dependencies: AgentDependencies
): Promise<OutOfBandInvitation> => {
  const parsedUrl = parseUrl(invitationUrl).query
  if (parsedUrl['oob']) {
    const outOfBandInvitation = OutOfBandInvitation.fromUrl(invitationUrl)
    return outOfBandInvitation
  } else if (parsedUrl['c_i' || parsedUrl['d_m']]) {
    const invitation = await ConnectionInvitationMessage.fromUrl(invitationUrl)
    return convertToNewInvitation(invitation)
  } else {
    try {
      return fromShortUrl(await fetchShortUrl(invitationUrl, dependencies))
    } catch (error) {
      throw new AriesFrameworkError(
        'InvitationUrl is invalid. It needs to contain one, and only one, of the following parameters: `oob`, `c_i` or `d_m`, or be valid shortened URL'
      )
    }
  }
}
