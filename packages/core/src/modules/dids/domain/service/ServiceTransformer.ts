import type { ClassConstructor } from 'class-transformer'

import { Transform, plainToInstance } from 'class-transformer'

import { DidCommV1Service } from './DidCommV1Service'
import { DidCommV2Service } from './DidCommV2Service'
import { DidDocumentService } from './DidDocumentService'
import { IndyAgentService } from './IndyAgentService'

export const serviceTypes: { [key: string]: unknown | undefined } = {
  [IndyAgentService.type]: IndyAgentService,
  [DidCommV1Service.type]: DidCommV1Service,
  [DidCommV2Service.type]: DidCommV2Service,
}

/**
 * Decorator that transforms service json to corresponding class instances. See {@link serviceTypes}
 *
 * @example
 * class Example {
 *   ServiceTransformer()
 *   private service: Service
 * }
 */
export function ServiceTransformer() {
  return Transform(
    ({ value }: { value?: Array<{ type: string }> }) => {
      return value?.map((serviceJson) => {
        const serviceClass = (serviceTypes[serviceJson.type] ??
          DidDocumentService) as ClassConstructor<DidDocumentService>
        const service = plainToInstance<DidDocumentService, unknown>(serviceClass, serviceJson)

        return service
      })
    },
    {
      toClassOnly: true,
    }
  )
}
