import { ConnectionInvitationMessage } from '../../modules/connections'
import { MessageValidator } from '../MessageValidator'

describe('MessageValidator', () => {
  describe('validate', () => {
    it('validates a class instance of ConnectionMessage', () => {
      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test1234',
        id: 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
      })

      expect(MessageValidator.validate(invitation)).resolves
    })
    it('throws an error for an invalid class instance of ConnectionMessage', () => {
      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test1234',
        id: 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
      })

      invitation.did = 'hello, world!'

      expect(MessageValidator.validate(invitation)).rejects
    })
  })

  describe('validateSync', () => {
    it('validates a class instance correctly', () => {
      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test1234',
        id: 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
      })

      expect(MessageValidator.validateSync(invitation, ConnectionInvitationMessage)).toEqual([])
    })
    it('throws an error for invalid class instance', () => {
      const invitation = new ConnectionInvitationMessage({
        did: 'did:sov:test1234',
        id: 'afe2867e-58c3-4a8d-85b2-23370dd9c9f0',
        label: 'test-label',
      })
      invitation.did = 'jnsjcd'

      expect(MessageValidator.validateSync(invitation, ConnectionInvitationMessage)).toThrow
    })
  })
})
