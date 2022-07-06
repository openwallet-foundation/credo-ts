import { Lifecycle, scoped } from 'tsyringe'

import { ContactRecord, ContactRepository, ContactTags } from './repository'
import { ContactService } from './services'

@scoped(Lifecycle.ContainerScoped)
export class ContactModule {
  private contactRepository: ContactRepository
  private contactService: ContactService

  public constructor(
    contactRepository: ContactRepository,
    contactService: ContactService
  ) {
    this.contactRepository = contactRepository
    this.contactService = contactService
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
