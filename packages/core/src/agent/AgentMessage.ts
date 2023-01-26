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
  // Only used internally
  @Exclude()
  public readonly protocolUsesLegacyDidSovPrefix: boolean = false

  public toJSON({ useLegacyDidSovPrefix }: { useLegacyDidSovPrefix?: boolean } = {}): Record<string, unknown> {
    const json = JsonTransformer.toJSON(this)

    // If the protocol historically uses the legacy did:sov prefix, and we have enabled using this legacy prefix, we
    // only use it for protocol messages that historically used it.
    if (this.protocolUsesLegacyDidSovPrefix && useLegacyDidSovPrefix) {
      replaceNewDidCommPrefixWithLegacyDidSovOnMessage(json)
    }

    return json
  }

  public is<C extends typeof AgentMessage>(Class: C): this is InstanceType<C> {
    return this.type === Class.type.messageTypeUri
  }
}
