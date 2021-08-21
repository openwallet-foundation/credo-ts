import type { MediationRecord } from '@aries-framework/core'
import type { PayloadAction, SerializedError } from '@reduxjs/toolkit'

import { createSlice } from '@reduxjs/toolkit'

import { MediationThunks } from './mediationThunks'

interface MediationState {
  mediation: {
    records: MediationRecord[]
    isLoading: boolean
  }
  error: null | SerializedError
}

const initialState: MediationState = {
  mediation: {
    records: [],
    isLoading: false,
  },
  error: null,
}

const mediationSlice = createSlice({
  name: 'mediation',
  initialState,
  reducers: {
    updateOrAdd: (state, action: PayloadAction<MediationRecord>) => {
      const index = state.mediation.records.findIndex((record) => record.id == action.payload.id)

      if (index == -1) {
        // records doesn't exist, add it
        state.mediation.records.push(action.payload)
        return state
      }

      // record does exist, update it
      state.mediation.records[index] = action.payload
      return state
    },
  },
  extraReducers: (builder) => {
    builder
      // getAllMediators
      .addCase(MediationThunks.getAllMediationRecords.pending, (state) => {
        state.mediation.isLoading = true
      })
      .addCase(MediationThunks.getAllMediationRecords.rejected, (state, action) => {
        state.mediation.isLoading = false
        state.error = action.error
      })
      .addCase(MediationThunks.getAllMediationRecords.fulfilled, (state, action) => {
        state.mediation.isLoading = false
        state.mediation.records = action.payload
      })
  },
})

export { mediationSlice }

export type { MediationState }
