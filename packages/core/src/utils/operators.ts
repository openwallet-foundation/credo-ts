import type { BaseEvent } from '../agent/Events'
import type { BaseRecord } from '../storage/BaseRecord'

import { filter, pipe } from 'rxjs'

/**
 *
 * @param type Record type (extends BaseRecord type)
 * @returns UnaryFunction
 */
export function filterByRecordType<T extends BaseRecord<any, any, any>>(type: string) {
  return pipe(filter((e: BaseEvent) => (e.payload as Record<string, T>).record.type === type))
}
