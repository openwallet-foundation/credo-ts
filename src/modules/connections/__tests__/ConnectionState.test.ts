import { ConnectionState } from '../models/ConnectionState'

describe('ConnectionState', () => {
  test('state matches Connection 1.0 (RFC 0160) state value', () => {
    expect(ConnectionState.Init).toBe('init')
    expect(ConnectionState.Invited).toBe('invited')
    expect(ConnectionState.Requested).toBe('requested')
    expect(ConnectionState.Responded).toBe('responded')
    expect(ConnectionState.Complete).toBe('complete')
  })
})
