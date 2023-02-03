import type { ParsedMessageType } from '../utils/messageType'
import type { Constructor } from '../utils/mixins'

import { Exclude } from 'class-transformer'

import { AckDecorated } from '../decorators/ack/AckDecoratorExtension'
import { AttachmentDecorated } from '../decorators/attachment/AttachmentExtension'
import { L10nDecorated } from '../decorators/l10n/L10nDecoratorExtension'
import { ServiceDecorated } from '../decorators/service/ServiceDecoratorExtension'
import { ThreadDecorated } from '../decorators/thread/ThreadDecoratorExtension'
import { TimingDecorated } from '../decorators/timing/TimingDecoratorExtension'
import { TransportDecorated } from '../decorators/transport/TransportDecoratorExtension'
import { JsonTransformer } from '../utils/JsonTransformer'
import { replaceNewDidCommPrefixWithLegacyDidSovOnMessage } from '../utils/messageType'

import { BaseMessage } from './BaseMessage'

export type ConstructableAgentMessage = Constructor<AgentMessage> & { type: ParsedMessageType }

const Decorated = ThreadDecorated(
  L10nDecorated(TransportDecorated(TimingDecorated(AckDecorated(AttachmentDecorated(ServiceDecorated(BaseMessage))))))
)

export class AgentMessage extends Decorated {
  /**
   * Whether the protocol RFC was initially written using the legacy did:prefix instead of the
   * new https://didcomm.org message type prefix.
   *
   * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0348-transition-msg-type-to-https/README.md
   */
  @Exclude()
  public readonly allowDidSovPrefix: boolean = false

  public toJSON({ useDidSovPrefixWhereAllowed }: { useDidSovPrefixWhereAllowed?: boolean } = {}): Record<
    string,
    unknown
  > {
    const json = JsonTransformer.toJSON(this)

    // If we have `useDidSovPrefixWhereAllowed` enabled, we want to replace the new https://didcomm.org prefix with the legacy did:sov prefix.
    // However, we only do this if the protocol RFC was initially written with the did:sov message type prefix
    // See https://github.com/hyperledger/aries-rfcs/blob/main/features/0348-transition-msg-type-to-https/README.md
    if (this.allowDidSovPrefix && useDidSovPrefixWhereAllowed) {
      replaceNewDidCommPrefixWithLegacyDidSovOnMessage(json)
    }

    return json
  }

  public is<C extends typeof AgentMessage>(Class: C): this is InstanceType<C> {
    return this.type === Class.type.messageTypeUri
  }
}
