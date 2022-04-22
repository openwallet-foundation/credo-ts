import { JsonTransformer } from '../../../utils/JsonTransformer'

import { DIDCommV2BaseMessage } from './DIDCommV2BaseMessage'

export class DIDCommV2Message extends DIDCommV2BaseMessage {
  public toJSON(): Record<string, unknown> {
    return JsonTransformer.toJSON(this)
  }

  // TODO: will be implemented by return_route attachment
  public hasAnyReturnRoute() {
    return false
  }

  public is<C extends typeof DIDCommV2Message>(Class: C): this is InstanceType<C> {
    return this.type === Class.type
  }
}
