import type { Agent, MediationStateChangedEvent } from '@aries-framework/core'
import type { EnhancedStore } from '@reduxjs/toolkit'

import { RoutingEventTypes } from '@aries-framework/core'

import { mediationSlice } from './mediationSlice'

/**
 * Starts an EventListener that listens for MediationRecords state changes
 * and updates the store accordingly.
 *
 * This function **must** be called if you're working with MediationRecords.
 * If you don't, the store won't be updated.
 */
const startMediationListener = (agent: Agent, store: EnhancedStore) => {
  const listener = (event: MediationStateChangedEvent) => {
    const record = event.payload.mediationRecord
    store.dispatch(mediationSlice.actions.updateOrAdd(record))
  }

  agent.events.on(RoutingEventTypes.MediationStateChanged, listener)

  return () => {
    agent.events.off(RoutingEventTypes.MediationStateChanged, listener)
  }
}

export { startMediationListener }
