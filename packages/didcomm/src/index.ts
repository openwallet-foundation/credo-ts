export * from './errors'
export * from './handlers'
export * from './messages'
export * from './models'
export * from './modules'
export * from './repository'
export * from './services'
export * from './transport'
export * from './types'

export * from './DidCommEvents'
export type { DidCommTransportSession } from './DidCommTransportService'
export { DidCommTransportService } from './DidCommTransportService'
export { DidCommAttachment, DidCommAttachmentData } from './decorators/attachment/DidCommAttachment'
export { ServiceDecorator, type ServiceDecoratorOptions } from './decorators/service/ServiceDecorator'
export { ReturnRouteTypes } from './decorators/transport/TransportDecorator'
export { AckDecorator } from './decorators/ack/AckDecorator'

export { DidCommFeatureRegistry } from './DidCommFeatureRegistry'
export { DidCommMessage } from './DidCommMessage'
export { DidCommDispatcher } from './DidCommDispatcher'
export { DidCommEnvelopeService } from './DidCommEnvelopeService'
export { DidCommMessageSender } from './DidCommMessageSender'
export { DidCommMessageReceiver } from './DidCommMessageReceiver'
export { DidCommMessageHandlerRegistry } from './DidCommMessageHandlerRegistry'

export { DidCommApi } from './DidCommApi'
export { DidCommModule } from './DidCommModule'
export { DidCommModuleConfig, type DidCommModuleConfigOptions } from './DidCommModuleConfig'

export { getOutboundDidCommMessageContext } from './getDidCommOutboundMessageContext'

export {
  type ParsedMessageType,
  parseMessageType,
  IsValidMessageType,
  replaceLegacyDidSovPrefix,
} from './util/messageType'

export { DidCommLinkedAttachment, type DidCommLinkedAttachmentOptions } from './util/DidCommLinkedAttachment'
export { oobInvitationFromShortUrl, parseInvitationUrl, parseInvitationShortUrl } from './util/parseInvitation'
export { encodeAttachment, isLinkedAttachment } from './util/attachment'
export { isValidJweStructure } from './util/JWE'
