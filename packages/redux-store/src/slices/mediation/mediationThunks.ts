import { createAsyncAgentThunk } from '../../utils'

/**
 * Namespace containing all **mediation** related actions.
 */
const MediationThunks = {
  /**
   * Retrieve all Mediation records
   */
  getAllMediationRecords: createAsyncAgentThunk('mediation/getAll', async (_, thunkApi) => {
    return thunkApi.extra.agent.mediationRecipient.getMediators()
  }),
}

export { MediationThunks }
