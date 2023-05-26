import type { Agent, V2TrustPingReceivedEvent, V2TrustPingResponseReceivedEvent } from '@aries-framework/core'

import { TrustPingEventTypes } from '@aries-framework/core'

import { BaseListener } from '../BaseListener'
import { purpleText } from '../OutputClass'

export class Listener extends BaseListener {
  public constructor() {
    super()
  }

  public pingListener(agent: Agent, name: string) {
    agent.events.on(TrustPingEventTypes.V2TrustPingReceivedEvent, async (event: V2TrustPingReceivedEvent) => {
      this.ui.updateBottomBar(purpleText(`\n${name} received ping message from ${event.payload.message.from}\n`))
    })
    agent.events.on(
      TrustPingEventTypes.V2TrustPingResponseReceivedEvent,
      async (event: V2TrustPingResponseReceivedEvent) => {
        this.ui.updateBottomBar(
          purpleText(`\n${name} received ping response message from ${event.payload.message.from}\n`)
        )
      }
    )
  }
}
