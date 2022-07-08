import type { ContactRecord, ContactTags } from './repository'

import { Lifecycle, scoped } from 'tsyringe'

import { ContactRepository } from './repository'
import { ContactService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class ContactModule {
  private contactRepository: ContactRepository
  private contactService: ContactService

  public constructor(contactRepository: ContactRepository, contactService: ContactService) {
    this.contactRepository = contactRepository
    this.contactService = contactService
  }

  public save(record: ContactRecord) {
    return this.contactService.save(record)
  }

  public getAll(): Promise<ContactRecord[]> {
    return this.contactService.getAll()
  }

  public async findAllByQuery(query: Partial<ContactTags>) {
    return this.contactService.findAllByQuery(query)
  }

  public async getById(recordId: string): Promise<ContactRecord> {
    return this.contactService.getById(recordId)
  }
}
