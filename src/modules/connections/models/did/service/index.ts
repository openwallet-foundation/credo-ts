import { Transform, ClassConstructor, plainToClass } from 'class-transformer'

import { IndyAgentService } from './IndyAgentService'
import { DIDCommService } from './DIDCommService'
import { Service } from './Service'

export const serviceTypes: { [key: string]: unknown | undefined } = {
  [IndyAgentService.type]: IndyAgentService,
  [DIDCommService.type]: DIDCommService,
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
    ({ value }: { value: { type: string }[] }) => {
      return value.map((serviceJson) => {
        const serviceClass = (serviceTypes[serviceJson.type] ?? Service) as ClassConstructor<Service>
        const service = plainToClass<Service, unknown>(serviceClass, serviceJson)

        return service
      })
    },
    {
      toClassOnly: true,
    }
  )
}

export { IndyAgentService, DIDCommService, Service }
