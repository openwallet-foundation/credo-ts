import { DidCommConnectionState, rfc0160StateFromDidExchangeState } from '../DidCommConnectionState'
import { DidCommDidExchangeState } from '../DidCommDidExchangeState'

describe('ConnectionState', () => {
  test('state matches Connection 1.0 (RFC 0160) state value', () => {
    expect(DidCommConnectionState.Null).toBe('null')
    expect(DidCommConnectionState.Invited).toBe('invited')
    expect(DidCommConnectionState.Requested).toBe('requested')
    expect(DidCommConnectionState.Responded).toBe('responded')
    expect(DidCommConnectionState.Complete).toBe('complete')
  })

  describe('rfc0160StateFromDidExchangeState', () => {
    it('should return the connection state for all did exchanges states', () => {
      expect(rfc0160StateFromDidExchangeState(DidCommDidExchangeState.Abandoned)).toEqual(DidCommConnectionState.Null)
      expect(rfc0160StateFromDidExchangeState(DidCommDidExchangeState.Start)).toEqual(DidCommConnectionState.Null)

      expect(rfc0160StateFromDidExchangeState(DidCommDidExchangeState.InvitationReceived)).toEqual(DidCommConnectionState.Invited)
      expect(rfc0160StateFromDidExchangeState(DidCommDidExchangeState.InvitationSent)).toEqual(DidCommConnectionState.Invited)

      expect(rfc0160StateFromDidExchangeState(DidCommDidExchangeState.RequestReceived)).toEqual(DidCommConnectionState.Requested)
      expect(rfc0160StateFromDidExchangeState(DidCommDidExchangeState.RequestSent)).toEqual(DidCommConnectionState.Requested)

      expect(rfc0160StateFromDidExchangeState(DidCommDidExchangeState.ResponseReceived)).toEqual(DidCommConnectionState.Responded)
      expect(rfc0160StateFromDidExchangeState(DidCommDidExchangeState.ResponseReceived)).toEqual(DidCommConnectionState.Responded)

      expect(rfc0160StateFromDidExchangeState(DidCommDidExchangeState.Completed)).toEqual(DidCommConnectionState.Complete)
    })
  })
})
