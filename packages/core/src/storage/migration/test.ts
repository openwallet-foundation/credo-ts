import { agentDependencies } from '../../../../node/src'
import { TestLogger } from '../../../tests/logger'
import { LogLevel } from '../../logger'

import { UpgradeAssistant } from './UpgradeAssistant'

async function run() {
  const upgradeAssistant = new UpgradeAssistant(
    {
      walletConfig: { id: 'migration', key: 'migration' },
      logger: new TestLogger(LogLevel.trace),
    },
    agentDependencies
  )

  await upgradeAssistant.initialize()
  const isUpToDate = await upgradeAssistant.isUpToDate()

  if (!isUpToDate) {
    await upgradeAssistant.upgrade()
  }
}

run()
