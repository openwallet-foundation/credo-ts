import type { ContactStateChangedEvent } from '../ContactEvents'
import type { ContactTags } from '../repository'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { EventEmitter } from '../../../agent/EventEmitter'
import { ContactEventTypes } from '../ContactEvents'
import { ContactRecord, ContactRepository } from '../repository'

@scoped(Lifecycle.ContainerScoped)
export class ContactService {
  private config: AgentConfig
  private contactRepository: ContactRepository
  private eventEmitter: EventEmitter

  public constructor(config: AgentConfig, contactRepository: ContactRepository, eventEmitter: EventEmitter) {
    this.config = config
    this.contactRepository = contactRepository
    this.eventEmitter = eventEmitter
  }

  public async save({ did, name }: ContactRecord) {
    const contactRecord = new ContactRecord({ did, name })

    await this.contactRepository.save(contactRecord)
    this.eventEmitter.emit<ContactStateChangedEvent>({
      type: ContactEventTypes.ContactStateChanged,
      payload: { record: contactRecord },
    })
  }

  public async getAll(): Promise<ContactRecord[]> {
    return this.contactRepository.getAll()
  }

  public async getById(recordId: string): Promise<ContactRecord> {
    return this.contactRepository.getById(recordId)
  }

  public async findAllByQuery(query: Partial<ContactTags>) {
    return this.contactRepository.findByQuery(query)
  }
}
