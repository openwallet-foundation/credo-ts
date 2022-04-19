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

const Decorated = ThreadDecorated(
  L10nDecorated(TransportDecorated(TimingDecorated(AckDecorated(AttachmentDecorated(ServiceDecorated(BaseMessage))))))
)

export class AgentMessage extends Decorated {
  public toJSON({ useLegacyDidSovPrefix = false }: { useLegacyDidSovPrefix?: boolean } = {}): Record<string, unknown> {
    const json = JsonTransformer.toJSON(this)

    if (useLegacyDidSovPrefix) {
      replaceNewDidCommPrefixWithLegacyDidSovOnMessage(json)
    }

    return json
  }

  public is<C extends typeof AgentMessage>(Class: C): this is InstanceType<C> {
    return this.type === Class.type.messageTypeUri
  }
}
