import type { Agent } from '../../agent/Agent'
import type { VersionString } from '../../utils/version'
import type { V0_1ToV0_2UpdateConfig } from './updates/0.1-0.2'

import { updateV0_1ToV0_2 } from './updates/0.1-0.2'

export const INITIAL_STORAGE_VERSION = '0.1'

export interface Update {
  fromVersion: VersionString
  toVersion: VersionString
  doUpdate: (agent: Agent, updateConfig: UpdateConfig) => Promise<void>
}

export interface UpdateConfig {
  v0_1ToV0_2: V0_1ToV0_2UpdateConfig
}

export const DEFAULT_UPDATE_CONFIG: UpdateConfig = {
  v0_1ToV0_2: {
    mediationRoleUpdateStrategy: 'recipientIfEndpoint',
  },
}

export const supportedUpdates: Update[] = [
  {
    fromVersion: '0.1',
    toVersion: '0.2',
    doUpdate: updateV0_1ToV0_2,
  },
]

// Current version is last toVersion from the supported updates
export const CURRENT_FRAMEWORK_STORAGE_VERSION = supportedUpdates[supportedUpdates.length - 1].toVersion
