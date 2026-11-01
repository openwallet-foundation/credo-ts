import path from 'node:path'
import { testRecordEncoding } from '../../../../core/tests/recordEncoding'
import { ActionMenuRole } from '../../ActionMenuRole'
import { ActionMenuState } from '../../ActionMenuState'
import { ActionMenu, ActionMenuFormInputType, ActionMenuSelection } from '../../models'
import { ActionMenuRecord } from '../ActionMenuRecord'

const createdAt = new Date('2026-01-01T00:00:00.000Z')
const updatedAt = new Date('2026-01-02T00:00:00.000Z')

testRecordEncoding(path.join(__dirname, '__fixtures__/records'), {
  ActionMenuRecord: () => {
    const record = new ActionMenuRecord({
      id: 'action-menu-record-id',
      createdAt,
      tags: { custom: 'tag' },
      state: ActionMenuState.Done,
      role: ActionMenuRole.Requester,
      connectionId: 'connection-id',
      threadId: 'thread-id',
      menu: new ActionMenu({
        title: 'Welcome',
        description: 'Choose an option',
        options: [
          {
            name: 'search',
            title: 'Search',
            description: 'Search the catalogue',
            disabled: false,
            form: {
              description: 'Enter your search',
              submitLabel: 'Search now',
              params: [
                {
                  name: 'query',
                  title: 'Query',
                  default: 'credentials',
                  description: 'The search query',
                  required: true,
                  type: ActionMenuFormInputType.Text,
                },
              ],
            },
          },
          {
            name: 'help',
            title: 'Help',
            description: 'Get help',
            disabled: true,
          },
        ],
      }),
      performedAction: new ActionMenuSelection({
        name: 'search',
        params: { query: 'credentials' },
      }),
    })
    record.updatedAt = updatedAt
    record.metadata.set('meta', { key: 'value' })
    return record
  },
})
