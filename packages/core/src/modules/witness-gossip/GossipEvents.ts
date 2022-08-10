import type { BaseEvent } from '../../agent/Events'
import type { WitnessData } from '../value-transfer'

export enum GossipEventTypes {
  WitnessTableReceived = 'WitnessTableReceived',
}

export interface WitnessTableReceivedEvent extends BaseEvent {
  type: typeof GossipEventTypes.WitnessTableReceived
  payload: {
    witnesses: WitnessData[]
  }
}
