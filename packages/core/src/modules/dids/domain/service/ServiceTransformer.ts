import type { ClassConstructor } from 'class-transformer'

import { Transform } from 'class-transformer'

import { JsonTransformer } from '../../../../utils'

import { DidCommV1Service } from './DidCommV1Service'
import { DidCommV2Service } from './DidCommV2Service'
import { DidDocumentService } from './DidDocumentService'
import { IndyAgentService } from './IndyAgentService'
import { NewDidCommV2Service } from './NewDidCommV2Service'

export const serviceTypes: { [key: string]: unknown | undefined } = {
  [IndyAgentService.type]: IndyAgentService,
  [DidCommV1Service.type]: DidCommV1Service,
  [NewDidCommV2Service.type]: NewDidCommV2Service,
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
        let serviceClass = (serviceTypes[serviceJson.type] ??
          DidDocumentService) as ClassConstructor<DidDocumentService>

        // NOTE: deal with `DIDCommMessaging` type but using `serviceEndpoint` string value, parse it using the
        // legacy class type
        if (
          serviceJson.type === NewDidCommV2Service.type &&
          'serviceEndpoint' in serviceJson &&
          typeof serviceJson.serviceEndpoint === 'string'
        ) {
          serviceClass = DidCommV2Service
        }

        const service = JsonTransformer.fromJSON(serviceJson, serviceClass)

        return service
      })
    },
    {
      toClassOnly: true,
    }
  )
}
