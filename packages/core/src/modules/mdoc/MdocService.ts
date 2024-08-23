import type { MdocVerifyOptions } from './MdocOptions'
import type { Query, QueryOptions } from '../../storage/StorageService'

import { injectable } from 'tsyringe'

import { AgentContext } from '../../agent'
import { TypedArrayEncoder } from '../../utils'
import { X509ModuleConfig } from '../x509'

import { Mdoc } from './Mdoc'
import { MdocError } from './MdocError'
import { MdocRecord, MdocRepository } from './repository'

/**
 * @internal
 */
@injectable()
export class MdocService {
  private MdocRepository: MdocRepository

  public constructor(mdocRepository: MdocRepository) {
    this.MdocRepository = mdocRepository
  }

  public fromIssuerSignedHex(hexEncodedMdoc: string) {
    return Mdoc.fromIssuerSignedHex(hexEncodedMdoc)
  }

  public fromIssuerSignedBase64(issuerSignedBase64: string) {
    const hexEncodedMdoc = TypedArrayEncoder.fromBase64(issuerSignedBase64).toString('hex')

    return Mdoc.fromIssuerSignedHex(hexEncodedMdoc)
  }

  public async verify(agentContext: AgentContext, options: MdocVerifyOptions) {
    const { mdoc } = options
    const trustedCertificates =
      options.trustedCertificates ?? agentContext.dependencyManager.resolve(X509ModuleConfig).trustedCertificates

    if (!trustedCertificates) {
      throw new MdocError('Mdoc Verification failed. Missing trusted certificates.')
    }

    return await mdoc.verifyCredential(agentContext, { trustedCertificates })
  }

  public async store(agentContext: AgentContext, mdoc: Mdoc) {
    const mdocRecord = new MdocRecord({ mdoc })
    await this.MdocRepository.save(agentContext, mdocRecord)

    return mdocRecord
  }

  public async getById(agentContext: AgentContext, id: string): Promise<MdocRecord> {
    return await this.MdocRepository.getById(agentContext, id)
  }

  public async getAll(agentContext: AgentContext): Promise<Array<MdocRecord>> {
    return await this.MdocRepository.getAll(agentContext)
  }

  public async findByQuery(
    agentContext: AgentContext,
    query: Query<MdocRecord>,
    queryOptions?: QueryOptions
  ): Promise<Array<MdocRecord>> {
    return await this.MdocRepository.findByQuery(agentContext, query, queryOptions)
  }

  public async deleteById(agentContext: AgentContext, id: string) {
    await this.MdocRepository.deleteById(agentContext, id)
  }

  public async update(agentContext: AgentContext, mdocRecord: MdocRecord) {
    await this.MdocRepository.update(agentContext, mdocRecord)
  }
}
