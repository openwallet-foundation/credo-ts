import type { ServiceDecorator } from '../../../decorators/service/ServiceDecorator'
import type { DIDCommMessage } from '../DIDCommMessage'

import { AckDecorated } from '../../../decorators/ack/AckDecoratorExtension'
import { AttachmentDecorated } from '../../../decorators/attachment/AttachmentExtension'
import { L10nDecorated } from '../../../decorators/l10n/L10nDecoratorExtension'
import { ServiceDecorated } from '../../../decorators/service/ServiceDecoratorExtension'
import { ThreadDecorated } from '../../../decorators/thread/ThreadDecoratorExtension'
import { TimingDecorated } from '../../../decorators/timing/TimingDecoratorExtension'
import { TransportDecorated } from '../../../decorators/transport/TransportDecoratorExtension'
import { JsonTransformer } from '../../../utils/JsonTransformer'
import { replaceNewDidCommPrefixWithLegacyDidSovOnMessage } from '../../../utils/messageType'
import { DIDCommMessageVersion } from '../types'

import { DIDCommV1BaseMessage } from './DIDCommV1BaseMessage'

const Decorated = ThreadDecorated(
  L10nDecorated(
    TransportDecorated(TimingDecorated(AckDecorated(AttachmentDecorated(ServiceDecorated(DIDCommV1BaseMessage)))))
  )
)

export class DIDCommV1Message extends Decorated implements DIDCommMessage {
  public get version(): DIDCommMessageVersion {
    return DIDCommMessageVersion.V1
  }

  public get sender(): string | undefined {
    return undefined
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

  public is<C extends typeof DIDCommV1Message>(Class: C): this is InstanceType<C> {
    return this.type === Class.type.messageTypeUri
  }
}
