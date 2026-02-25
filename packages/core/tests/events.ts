import { ReplaySubject } from 'rxjs'
import type { Agent, BaseEvent } from '../src'

export type EventReplaySubject = ReplaySubject<BaseEvent>

export function setupEventReplaySubjects(agents: Agent[], eventTypes: string[]): ReplaySubject<BaseEvent>[] {
  const replaySubjects: EventReplaySubject[] = []

  for (const agent of agents) {
    const replaySubject = new ReplaySubject<BaseEvent>()

    for (const eventType of eventTypes) {
      agent.events.observable(eventType).subscribe(replaySubject)
    }

    replaySubjects.push(replaySubject)
  }

  return replaySubjects
}
