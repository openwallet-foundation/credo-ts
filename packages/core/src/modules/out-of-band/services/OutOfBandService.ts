import type { ContactService } from '../../contacts/services'
import type { DidService } from '../../dids'

import { DidType } from '../../dids'

import { OutOfBandGoalCode, OutOfBandInvitationMessage } from './OutOfBandInvitationMessage'

export class OutOfBandService {
  private contactService: ContactService
  private didService: DidService

  public constructor(contactService: ContactService, didService: DidService) {
    this.contactService = contactService
    this.didService = didService
  }

  public async createOutOfBandInvitation({
    goal,
    goalCode,
    usePublicDid,
  }: {
    goal: string
    goalCode: string
    usePublicDid?: boolean
  }) {
    const publicDid = await this.didService.findPublicDid()
    const did = usePublicDid && publicDid ? publicDid : (await this.didService.createDID(DidType.PeerDid)).id
    return new OutOfBandInvitationMessage({
      from: typeof did === 'string' ? did : did.did,
      body: {
        goal,
        goal_code: goalCode,
      },
    })
  }

  public acceptOutOfBandInvitation(message: OutOfBandInvitationMessage) {
    if (!message.from) {
      throw new Error('Invalid field "from"')
    }
    if (message.body.goalCode === OutOfBandGoalCode.makeConnection) {
      this.contactService.save({ did: message.from, name: '' })
    }
  }
}
