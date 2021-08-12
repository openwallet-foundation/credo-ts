import type { MediationState } from './mediationSlice'
import type { MediationState as MediationRecordState } from '@aries-framework/core'

interface PartialMediationState {
  mediation: MediationState
}

/**
 * Namespace that holds all MediationRecord related selectors.
 */
const MediationSelectors = {
  /**
   * Selector that retrieves the entire **mediation** store object.
   */
  mediationStateSelector: (state: PartialMediationState) => state.mediation.mediation,

  /**
   * Selector that retrieves all MediationRecord from the state.
   */
  mediationRecordsSelector: (state: PartialMediationState) => state.mediation.mediation.records,

  /**
   * Selector that retrieves all MediationRecord from the store by specified state.
   */
  mediationRecordsByStateSelector: (mediationState: MediationRecordState) => (state: PartialMediationState) =>
    state.mediation.mediation.records.filter((record) => record.state === mediationState),

  /**
   * Selector that fetches a MediationRecord by id from the state.
   */
  mediationRecordByIdSelector: (mediationRecordId: string) => (state: PartialMediationState) =>
    state.mediation.mediation.records.find((x) => x.id === mediationRecordId),
}

export { MediationSelectors }
