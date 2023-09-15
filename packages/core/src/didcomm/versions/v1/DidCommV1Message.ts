import type { PlaintextDidCommV1Message } from './types'
import type { AgentBaseMessage } from '../../../agent/AgentBaseMessage'
import type { ServiceDecorator } from '../../../decorators/service/ServiceDecorator'

import { Exclude } from 'class-transformer'

import { AckDecorated } from '../../../decorators/ack/AckDecoratorExtension'
import { AttachmentDecorated } from '../../../decorators/attachment'
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
    TransportDecorated(TimingDecorated(AckDecorated(AttachmentDecorated(ServiceDecorated(DidCommV1BaseMessage)))))
  )
)

export class DidCommV1Message extends Decorated implements AgentBaseMessage {
  /**
   * Whether the protocol RFC was initially written using the legacy did:prefix instead of the
   * new https://didcomm.org message type prefix.
   *
   * @see https://github.com/hyperledger/aries-rfcs/blob/main/features/0348-transition-msg-type-to-https/README.md
   */
  @Exclude()
  public readonly allowDidSovPrefix: boolean = false

  @Exclude()
  public readonly didCommVersion = DidCommMessageVersion.V1
  public static readonly didCommVersion = DidCommMessageVersion.V1

  public serviceDecorator(): ServiceDecorator | undefined {
    return this.service
  }

  public toJSON({
    useDidSovPrefixWhereAllowed,
  }: { useDidSovPrefixWhereAllowed?: boolean } = {}): PlaintextDidCommV1Message {
    const json = JsonTransformer.toJSON(this)

    // If we have `useDidSovPrefixWhereAllowed` enabled, we want to replace the new https://didcomm.org prefix with the legacy did:sov prefix.
    // However, we only do this if the protocol RFC was initially written with the did:sov message type prefix
    // See https://github.com/hyperledger/aries-rfcs/blob/main/features/0348-transition-msg-type-to-https/README.md
    if (this.allowDidSovPrefix && useDidSovPrefixWhereAllowed) {
      replaceNewDidCommPrefixWithLegacyDidSovOnMessage(json)
    }

    return json as PlaintextDidCommV1Message
  }

  public is<C extends typeof DidCommV1Message>(Class: C): this is InstanceType<C> {
    return this.type === Class.type.messageTypeUri
  }
}

// type alias to keep backward compatibility
export class AgentMessage extends DidCommV1Message {}
