import { getMockConnection, mockFunction } from '../../../../tests/helpers'
import { TrustPingMessage } from '../messages'
import { ConnectionState } from '../models'
import { ConnectionRepository } from '../repository/ConnectionRepository'
import { TrustPingService } from '../services/TrustPingService'

jest.mock('../repository/ConnectionRepository')
const ConnectionRepositoryMock = ConnectionRepository as jest.Mock<ConnectionRepository>

describe('TrustPingService', () => {
  let connectionRepository: ConnectionRepository
  let trustPingService: TrustPingService

  beforeEach(async () => {
    trustPingService = new TrustPingService()
    connectionRepository = new ConnectionRepositoryMock()
  })

  describe('createTrustPing', () => {
    it('returns a trust ping message', async () => {
      expect.assertions(2)

      const mockConnection = getMockConnection({
        state: ConnectionState.Complete,
      })
      mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(mockConnection))

      const message = await trustPingService.createTrustPing()

      expect(message).toEqual(expect.any(TrustPingMessage))
    })

    const invalidConnectionStates = [ConnectionState.Invited, ConnectionState.Requested]
    test.each(invalidConnectionStates)(
      `throws an error when connection state is %s and not ${ConnectionState.Responded} or ${ConnectionState.Complete}`,
      (state) => {
        expect.assertions(1)

        mockFunction(connectionRepository.getById).mockReturnValue(Promise.resolve(getMockConnection({ state })))
        return expect(trustPingService.createTrustPing()).rejects.toThrowError(
          `Connection record is in invalid state ${state}. Valid states are: ${ConnectionState.Responded}, ${ConnectionState.Complete}.`
        )
      }
    )
  })
})
