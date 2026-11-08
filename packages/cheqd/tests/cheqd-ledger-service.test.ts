import { CheqdQuerier, defaultResourceExtensionKey } from '@cheqd/sdk'

import testLogger from '../../core/tests/logger'
import { CheqdModuleConfig } from '../src/CheqdModuleConfig'
import { CheqdLedgerService } from '../src/ledger'
import { validDid } from './testUtils'

describe('CheqdLedgerService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should resolve without a cosmosPayerSeed', async () => {
    const resourceMetadata = vi.fn().mockResolvedValue({ id: 'resource-id' })
    vi.spyOn(CheqdQuerier, 'connectWithExtensions').mockResolvedValue({
      [defaultResourceExtensionKey]: { resourceMetadata },
    } as never)

    const ledgerService = new CheqdLedgerService(
      new CheqdModuleConfig({ networks: [{ network: 'testnet' }] }),
      testLogger
    )

    await expect(ledgerService.resolveResourceMetadata(validDid, 'collection-id', 'resource-id')).resolves.toEqual({
      id: 'resource-id',
    })
    expect(resourceMetadata).toHaveBeenCalledWith('collection-id', 'resource-id')
  })
})
