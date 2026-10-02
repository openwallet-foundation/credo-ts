import {
  DidCommV1Service,
  DidDocumentBuilder,
  DidKey,
  didDocumentToNumAlgo4Did,
  didKeyToVerkey,
  JsonTransformer,
  verkeyToDidKey,
} from '@credo-ts/core'
import { DidCommAttachment } from '../../decorators/attachment/DidCommAttachment'
import { mapV1AttachmentToV2, mapV2AttachmentToV1 } from '../../v2/plaintextBuilder'
import type { DidCommV2Attachment } from '../../v2/types'
import {
  DidCommConnectionInvitationMessage,
  type DidCommConnectionInvitationMessageOptions,
} from '../connections/messages/DidCommConnectionInvitationMessage'
import { OutOfBandDidCommService } from './domain/OutOfBandDidCommService'
import type { DidCommOutOfBandInvitationOptions } from './messages'
import { DidCommInvitationType, DidCommOutOfBandInvitation } from './messages/DidCommOutOfBandInvitation'
import type { DidCommOutOfBandInvitationV2 } from './messages/DidCommOutOfBandInvitationV2'

export function convertToNewInvitation(oldInvitation: DidCommConnectionInvitationMessage) {
  let service: string | OutOfBandDidCommService

  if (oldInvitation.did) {
    service = oldInvitation.did
  } else if (oldInvitation.serviceEndpoint && oldInvitation.recipientKeys && oldInvitation.recipientKeys.length > 0) {
    service = new OutOfBandDidCommService({
      id: '#inline',
      recipientKeys: oldInvitation.recipientKeys?.map(verkeyToDidKey),
      routingKeys: oldInvitation.routingKeys?.map(verkeyToDidKey),
      serviceEndpoint: oldInvitation.serviceEndpoint,
    })
  } else {
    throw new Error('Missing required serviceEndpoint, routingKeys and/or did fields in connection invitation')
  }

  const options: DidCommOutOfBandInvitationOptions = {
    id: oldInvitation.id,
    label: oldInvitation.label,
    imageUrl: oldInvitation.imageUrl,
    appendedAttachments: oldInvitation.appendedAttachments,
    accept: ['didcomm/aip1', 'didcomm/aip2;env=rfc19'],
    services: [service],
    // NOTE: we hardcode it to 1.0, we won't see support for newer versions of the protocol
    // and we also can process 1.0 if we support newer versions
    handshakeProtocols: ['https://didcomm.org/connections/1.0'],
  }

  const outOfBandInvitation = new DidCommOutOfBandInvitation(options)
  outOfBandInvitation.invitationType = DidCommInvitationType.Connection
  return outOfBandInvitation
}

export function convertToOldInvitation(newInvitation: DidCommOutOfBandInvitation) {
  // Taking first service, as we can only include one service in a legacy invitation.
  const [service] = newInvitation.getServices()

  let options: DidCommConnectionInvitationMessageOptions
  if (typeof service === 'string') {
    options = {
      id: newInvitation.id,
      // label is optional
      label: newInvitation.label ?? '',
      did: service,
      imageUrl: newInvitation.imageUrl,
      appendedAttachments: newInvitation.appendedAttachments,
    }
  } else {
    options = {
      id: newInvitation.id,
      // label is optional
      label: newInvitation.label ?? '',
      recipientKeys: service.recipientKeys.map(didKeyToVerkey),
      routingKeys: service.routingKeys?.map(didKeyToVerkey),
      serviceEndpoint: service.serviceEndpoint,
      imageUrl: newInvitation.imageUrl,
      appendedAttachments: newInvitation.appendedAttachments,
    }
  }

  const connectionInvitationMessage = new DidCommConnectionInvitationMessage(options)
  return connectionInvitationMessage
}

/**
 * Map a v2 attachment (`{ id, media_type, ... }`) to a typed `DidCommAttachment`
 * (`{ @id, mime-type, ... }`) by routing through the existing JSON-shape mapper and
 * letting class-transformer handle the rest. Avoids hand-writing every field.
 */
function v2AttachmentToDidCommAttachment(v2: DidCommV2Attachment): DidCommAttachment {
  return JsonTransformer.fromJSON(mapV2AttachmentToV1(v2), DidCommAttachment)
}

/**
 * Inverse of {@link v2AttachmentToDidCommAttachment}.
 */
export function didCommAttachmentToV2Attachment(att: DidCommAttachment): DidCommV2Attachment {
  return mapV1AttachmentToV2(JsonTransformer.toJSON(att) as Record<string, unknown>)
}

/**
 * Convert a `DidCommOutOfBandInvitationV2` (out-of-band/2.0 wire format) into the unified
 * `DidCommOutOfBandInvitation` used internally for record storage and dispatch.
 *
 * Used by both the create-side ({@link DidCommOutOfBandApi.createInvitation}) and the
 * receive-side parsers (`parseInvitation*`) so the resulting record has identical shape
 * regardless of how the invitation entered the agent.
 *
 * v2 attachments (carrying protocol messages) are surfaced as v1 `requests~attach` so the
 * existing v1 dispatch path (`getRequests()` consumers) handles them uniformly.
 */
export function convertV2InvitationToOutOfBandInvitation(
  v2Invitation: DidCommOutOfBandInvitationV2
): DidCommOutOfBandInvitation {
  const invitation = new DidCommOutOfBandInvitation({
    id: v2Invitation.id,
    goal: v2Invitation.body?.goal,
    goalCode: v2Invitation.body?.goalCode,
    services: [v2Invitation.from],
  })
  invitation.invitationType = DidCommInvitationType.V2OutOfBand
  invitation.v2Invitation = v2Invitation

  if (v2Invitation.attachments && v2Invitation.attachments.length > 0) {
    for (const v2Attachment of v2Invitation.attachments) {
      invitation.addRequestAttachment(v2AttachmentToDidCommAttachment(v2Attachment))
    }
  }

  return invitation
}

export function outOfBandServiceToNumAlgo4Did(service: OutOfBandDidCommService) {
  // FIXME: add the key entries for the recipientKeys to the did document.
  const didDocument = new DidDocumentBuilder('')
    .addService(
      new DidCommV1Service({
        id: service.id,
        serviceEndpoint: service.serviceEndpoint,
        accept: service.accept,
        // FIXME: this should actually be local key references, not did:key:123#456 references
        recipientKeys: service.recipientKeys.map((recipientKey) => {
          const did = DidKey.fromDid(recipientKey)
          return `${did.did}#${did.publicJwk.fingerprint}`
        }),
        // Map did:key:xxx to actual did:key:xxx#123
        routingKeys: service.routingKeys?.map((routingKey) => {
          const did = DidKey.fromDid(routingKey)
          return `${did.did}#${did.publicJwk.fingerprint}`
        }),
      })
    )
    .build()

  return didDocumentToNumAlgo4Did(didDocument)
}
