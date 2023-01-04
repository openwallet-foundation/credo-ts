import type { AgentMessage } from '../../../agent/AgentMessage'
import type { ServiceDecorator } from '../../../decorators/service/ServiceDecorator'

import { AckDecorated } from '../../../decorators/ack/AckDecoratorExtension'
import { V1AttachmentDecorated } from '../../../decorators/attachment/V1AttachmentExtension'
import { L10nDecorated } from '../../../decorators/l10n/L10nDecoratorExtension'
import { ServiceDecorated } from '../../../decorators/service/ServiceDecoratorExtension'
import { ThreadDecorated } from '../../../decorators/thread/ThreadDecoratorExtension'
import { TimingDecorated } from '../../../decorators/timing/TimingDecoratorExtension'
import { TransportDecorated } from '../../../decorators/transport/TransportDecoratorExtension'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { replaceNewDidCommPrefixWithLegacyDidSovOnMessage } from '../../../utils/messageType'
import { DidCommMessageVersion } from '../../types'

import { DidCommV1BaseMessage } from './DidCommV1BaseMessage'

const Decorated = ThreadDecorated(
  L10nDecorated(
    TransportDecorated(TimingDecorated(AckDecorated(V1AttachmentDecorated(ServiceDecorated(DidCommV1BaseMessage)))))
  )
)

export class DidCommV1Message extends Decorated implements AgentMessage {
  public get didCommVersion(): DidCommMessageVersion {
    return DidCommMessageVersion.V1
  }

  public serviceDecorator(): ServiceDecorator | undefined {
    return this.service
  }

  public toJSON({ useLegacyDidSovPrefix = false }: { useLegacyDidSovPrefix?: boolean } = {}): Record<string, unknown> {
    const json = JsonTransformer.toJSON(this)

    if (useLegacyDidSovPrefix) {
      replaceNewDidCommPrefixWithLegacyDidSovOnMessage(json)
    }

    return json
  }

  public is<C extends typeof DidCommV1Message>(Class: C): this is InstanceType<C> {
    return this.type === Class.type.messageTypeUri
  }
}
