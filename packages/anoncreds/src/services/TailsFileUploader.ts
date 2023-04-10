import { AgentContext, utils } from '@aries-framework/core'
import { AnonCredsRevocationRegistryDefinition } from '../models'
import FormData from 'form-data'
import fs from 'fs'

export interface TailsFileUploader {
  uploadTails(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
      localTailsFilePath: string
    }
  ): Promise<string>
}

export class DefaultTailsFileUploader implements TailsFileUploader {
  public async uploadTails(
    agentContext: AgentContext,
    options: {
      revocationRegistryDefinition: AnonCredsRevocationRegistryDefinition
    }
  ): Promise<string> {
    const revocationRegistryDefinition = options.revocationRegistryDefinition
    const localTailsFilePath = revocationRegistryDefinition.value.tailsLocation

    const tailsFileId = utils.uuid()
    const data = new FormData()
    const readStream = fs.createReadStream(localTailsFilePath)
    data.append('file', readStream)
    const response = await agentContext.config.agentDependencies.fetch(
      `http://localhost:3001/${encodeURIComponent(tailsFileId)}`,
      {
        method: 'PUT',
        body: data,
      }
    )
    if (response.status !== 200) {
      throw new Error('Cannot upload tails file')
    }
    return `http://localhost:3001/${encodeURIComponent(tailsFileId)}`
  }
}
