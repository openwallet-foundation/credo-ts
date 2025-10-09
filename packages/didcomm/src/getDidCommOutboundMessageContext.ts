import type { AgentContext, BaseRecordAny, ResolvedDidCommService } from '@credo-ts/core'
import type { DidCommMessage } from './DidCommMessage'
import type { DidCommRouting } from './models'
import type { DidCommConnectionRecord } from './modules/connections/repository'
import type { DidCommOutOfBandRecord } from './modules/oob'

import { CredoError, Kms, utils } from '@credo-ts/core'

import { ServiceDecorator } from './decorators/service/ServiceDecorator'
import { DidCommOutboundMessageContext } from './models'
import {
  DidCommInvitationType,
  DidCommOutOfBandRepository,
  DidCommOutOfBandRole,
  DidCommOutOfBandService,
} from './modules/oob'
import { DidCommOutOfBandRecordMetadataKeys } from './modules/oob/repository/outOfBandRecordMetadataTypes'
import { DidCommRoutingService } from './modules/routing'
import { DidCommMessageRepository, DidCommMessageRole } from './repository'

/**
 * Maybe these methods should be moved to a service, but that would require
 * extra injection in the sender functions, and I'm not 100% sure what would
 * be the best place to host these.
 */

/**
 * Get the outbound message context for a message. Will use the connection record if available,
 * and otherwise try to create a connectionless message context.
 */
export async function getOutboundDidCommMessageContext(
  agentContext: AgentContext,
  {
    message,
    connectionRecord,
    associatedRecord,
    lastReceivedMessage,
    lastSentMessage,
  }: {
    connectionRecord?: DidCommConnectionRecord
    associatedRecord?: BaseRecordAny
    message: DidCommMessage
    lastReceivedMessage?: DidCommMessage
    lastSentMessage?: DidCommMessage
  }
) {
  // TODO: even if using a connection record, we should check if there's an oob record associated and this
  // is the first response to the oob invitation. If so, we should add the parentThreadId to the message
  if (connectionRecord) {
    agentContext.config.logger.debug(
      `Creating outbound message context for message ${message.id} with connection ${connectionRecord.id}`
    )
    return new DidCommOutboundMessageContext(message, {
      agentContext,
      associatedRecord,
      connection: connectionRecord,
    })
  }

  if (!lastReceivedMessage) {
    throw new CredoError(
      'No connection record and no lastReceivedMessage was supplied. For connection-less exchanges the lastReceivedMessage is required.'
    )
  }

  if (!associatedRecord) {
    throw new CredoError(
      'No associated record was supplied. This is required for connection-less exchanges to store the associated ~service decorator on the message.'
    )
  }

  // Connectionless
  return getConnectionlessOutboundMessageContext(agentContext, {
    message,
    associatedRecord,
    lastReceivedMessage,
    lastSentMessage,
  })
}

export async function getConnectionlessOutboundMessageContext(
  agentContext: AgentContext,
  {
    message,
    lastReceivedMessage,
    lastSentMessage,
    associatedRecord,
  }: {
    message: DidCommMessage
    associatedRecord: BaseRecordAny
    lastReceivedMessage: DidCommMessage
    lastSentMessage?: DidCommMessage
  }
) {
  agentContext.config.logger.debug(
    `Creating outbound message context for message ${message.id} using connection-less exchange`
  )

  // FIXME: we should remove support for the flow where no out of band record is used.
  // Users have had enough time to update to the OOB API which supports legacy connectionsless
  // invitations as well
  const outOfBandRecord = await getOutOfBandRecordForMessage(agentContext, message)
  let { recipientService, ourService } = await getServicesForMessage(agentContext, {
    lastReceivedMessage,
    lastSentMessage,
    message,
    outOfBandRecord,
  })

  // We need to set up routing for this exchange if we haven't sent any messages yet.
  if (!lastSentMessage) {
    ourService = await createOurService(agentContext, { outOfBandRecord, message })
  }

  // These errors should not happen as they will be caught by the checks above. But if there's a path missed,
  // and to make typescript happy we add these checks.
  if (!ourService) {
    throw new CredoError(`Could not determine our service for connection-less exchange for message ${message.id}.`)
  }
  if (!recipientService) {
    throw new CredoError(
      `Could not determine recipient service for connection-less exchange for message ${message.id}.`
    )
  }

  // Adds the ~service and ~thread.pthid (if oob is used) to the message and updates it in storage.
  await addExchangeDataToMessage(agentContext, { message, ourService, outOfBandRecord, associatedRecord })

  return new DidCommOutboundMessageContext(message, {
    agentContext: agentContext,
    associatedRecord,
    serviceParams: {
      service: recipientService,
      senderKey: ourService.recipientKeys[0],
      returnRoute: true,
    },
  })
}

/**
 * Retrieves the out of band record associated with the message based on the thread id of the message.
 */
async function getOutOfBandRecordForMessage(agentContext: AgentContext, message: DidCommMessage) {
  agentContext.config.logger.debug(
    `Looking for out-of-band record for message ${message.id} with thread id ${message.threadId} and type ${message.type}`
  )
  const outOfBandRepository = agentContext.dependencyManager.resolve(DidCommOutOfBandRepository)

  const outOfBandRecord = await outOfBandRepository.findSingleByQuery(agentContext, {
    invitationRequestsThreadIds: [message.threadId],
  })

  return outOfBandRecord ?? undefined
}

/**
 * Returns the services to use for the message. When available it will extract the services from the
 * lastSentMessage and lastReceivedMessage. If not available it will try to extract the services from
 * the out of band record.
 *
 * If the required services and fields are not available, an error will be thrown.
 */
async function getServicesForMessage(
  agentContext: AgentContext,
  {
    lastSentMessage,
    lastReceivedMessage,
    message,
    outOfBandRecord,
  }: {
    lastSentMessage?: DidCommMessage
    lastReceivedMessage: DidCommMessage
    message: DidCommMessage
    outOfBandRecord?: DidCommOutOfBandRecord
  }
) {
  let ourService = lastSentMessage?.service?.resolvedDidCommService
  let recipientService = lastReceivedMessage.service?.resolvedDidCommService

  const outOfBandService = agentContext.dependencyManager.resolve(DidCommOutOfBandService)

  // Check if valid
  if (outOfBandRecord?.role === DidCommOutOfBandRole.Sender) {
    // Extract ourService from the oob record if not on a previous message
    if (!ourService) {
      ourService = await outOfBandService.getResolvedServiceForOutOfBandServices(
        agentContext,
        outOfBandRecord.outOfBandInvitation.getServices(),
        outOfBandRecord.invitationInlineServiceKeys
      )
    }

    if (!recipientService) {
      throw new CredoError(
        'Could not find a service to send the message to. Please make sure the connection has a service or provide a service to send the message to.'
      )
    }

    // We have created the oob record with a message, that message should be provided here as well
    if (!lastSentMessage) {
      throw new CredoError('Must have lastSentMessage when out of band record has role Sender')
    }
  } else if (outOfBandRecord?.role === DidCommOutOfBandRole.Receiver) {
    // Extract recipientService from the oob record if not on a previous message
    if (!recipientService) {
      recipientService = await outOfBandService.getResolvedServiceForOutOfBandServices(
        agentContext,
        outOfBandRecord.outOfBandInvitation.getServices()
      )
    }

    if (lastSentMessage && !ourService) {
      throw new CredoError(
        'Could not find a service to send the message to. Please make sure the connection has a service or provide a service to send the message to.'
      )
    }

    // We need to extract the kms key id for the connectinless exchange
    const oobRecordRecipientRouting = outOfBandRecord?.metadata.get(DidCommOutOfBandRecordMetadataKeys.RecipientRouting)
    if (oobRecordRecipientRouting && ourService) {
      ourService.recipientKeys[0].keyId =
        oobRecordRecipientRouting.recipientKeyId ?? ourService.recipientKeys[0].legacyKeyId
    }
  }
  // we either miss ourService (even though a message was sent) or we miss recipientService
  // we check in separate if statements to provide a more specific error message
  else {
    if (lastSentMessage && !ourService) {
      agentContext.config.logger.error(
        `No out of band record associated and missing our service for connection-less exchange for message ${message.id}, while previous message has already been sent.`
      )
      throw new CredoError(
        `No out of band record associated and missing our service for connection-less exchange for message ${message.id}, while previous message has already been sent.`
      )
    }

    if (!recipientService) {
      agentContext.config.logger.error(
        `No out of band record associated and missing recipient service for connection-less exchange for message ${message.id}.`
      )
      throw new CredoError(
        `No out of band record associated and missing recipient service for connection-less exchange for message ${message.id}.`
      )
    }
  }

  return { ourService, recipientService }
}

/**
 * Creates a new service for us as the sender to be used in a connection-less exchange.
 *
 * Will creating routing, which takes into account mediators, and will optionally extract
 * routing configuration from the out of band record if available.
 */
async function createOurService(
  agentContext: AgentContext,
  { outOfBandRecord, message }: { outOfBandRecord?: DidCommOutOfBandRecord; message: DidCommMessage }
): Promise<ResolvedDidCommService> {
  agentContext.config.logger.debug(
    `No previous sent message in thread for outbound message ${message.id} with type ${message.type}, setting up routing`
  )

  let routing: DidCommRouting | undefined = undefined

  // Extract routing from out of band record if possible
  const oobRecordRecipientRouting = outOfBandRecord?.metadata.get(DidCommOutOfBandRecordMetadataKeys.RecipientRouting)
  if (oobRecordRecipientRouting) {
    const recipientPublicJwk = Kms.PublicJwk.fromFingerprint(
      oobRecordRecipientRouting.recipientKeyFingerprint
    ) as Kms.PublicJwk<Kms.Ed25519PublicJwk>

    recipientPublicJwk.keyId = oobRecordRecipientRouting.recipientKeyId ?? recipientPublicJwk.legacyKeyId
    routing = {
      recipientKey: recipientPublicJwk,
      routingKeys: oobRecordRecipientRouting.routingKeyFingerprints.map(
        (fingerprint) => Kms.PublicJwk.fromFingerprint(fingerprint) as Kms.PublicJwk<Kms.Ed25519PublicJwk>
      ),
      endpoints: oobRecordRecipientRouting.endpoints,
      mediatorId: oobRecordRecipientRouting.mediatorId,
    }
  }

  if (!routing) {
    const routingService = agentContext.dependencyManager.resolve(DidCommRoutingService)
    routing = await routingService.getRouting(agentContext, {
      mediatorId: outOfBandRecord?.mediatorId,
    })

    // We need to store the routing so we can reference it in in the future.
    if (outOfBandRecord) {
      agentContext.config.logger.debug('Storing routing for out of band invitation.')
      outOfBandRecord.metadata.set(DidCommOutOfBandRecordMetadataKeys.RecipientRouting, {
        recipientKeyFingerprint: routing.recipientKey.fingerprint,
        recipientKeyId: routing.recipientKey.keyId,
        routingKeyFingerprints: routing.routingKeys.map((key) => key.fingerprint),
        endpoints: routing.endpoints,
        mediatorId: routing.mediatorId,
      })
      outOfBandRecord.setTags({ recipientRoutingKeyFingerprint: routing.recipientKey.fingerprint })
      const outOfBandRepository = agentContext.resolve(DidCommOutOfBandRepository)
      await outOfBandRepository.update(agentContext, outOfBandRecord)
    }
  }

  return {
    id: utils.uuid(),
    serviceEndpoint: routing.endpoints[0],
    recipientKeys: [routing.recipientKey],
    routingKeys: routing.routingKeys,
  }
}

async function addExchangeDataToMessage(
  agentContext: AgentContext,
  {
    message,
    ourService,
    outOfBandRecord,
    associatedRecord,
  }: {
    message: DidCommMessage
    ourService: ResolvedDidCommService
    outOfBandRecord?: DidCommOutOfBandRecord
    associatedRecord: BaseRecordAny
  }
) {
  const legacyInvitationMetadata = outOfBandRecord?.metadata.get(DidCommOutOfBandRecordMetadataKeys.LegacyInvitation)

  // Set the parentThreadId on the message from the oob invitation
  // If connectionless is used, we should not add the parentThreadId
  if (outOfBandRecord && legacyInvitationMetadata?.legacyInvitationType !== DidCommInvitationType.Connectionless) {
    if (!message.thread) {
      message.setThread({
        parentThreadId: outOfBandRecord.outOfBandInvitation.id,
      })
    } else {
      message.thread.parentThreadId = outOfBandRecord.outOfBandInvitation.id
    }
  }

  // Set the service on the message and save service decorator to record (to remember our verkey)
  // TODO: we should store this in the OOB record, but that would be a breaking change for now.
  // We can change this in 0.5.0
  message.service = ServiceDecorator.fromResolvedDidCommService(ourService)

  await agentContext.dependencyManager.resolve(DidCommMessageRepository).saveOrUpdateAgentMessage(agentContext, {
    agentMessage: message,
    role: DidCommMessageRole.Sender,
    associatedRecordId: associatedRecord.id,
  })
}
