import { instanceToPlain, plainToInstance } from 'class-transformer'

import { Service, ServiceTransformer, serviceTypes, IndyAgentService, DidCommService } from '../service'

describe('Did | Service', () => {
  it('should correctly transform Json to Service class', async () => {
    const json = {
      id: 'test-id',
      type: 'Mediator',
      serviceEndpoint: 'https://example.com',
    }
    const service = plainToInstance(Service, json)

    expect(service.id).toBe(json.id)
    expect(service.type).toBe(json.type)
    expect(service.serviceEndpoint).toBe(json.serviceEndpoint)
  })

  it('should correctly transform Service class to Json', async () => {
    const json = {
      id: 'test-id',
      type: 'Mediator',
      serviceEndpoint: 'https://example.com',
    }

    const service = new Service({
      ...json,
    })

    const transformed = instanceToPlain(service)

    expect(transformed).toEqual(json)
  })

  describe('IndyAgentService', () => {
    it('should correctly transform Json to IndyAgentService class', async () => {
      const json = {
        id: 'test-id',
        type: 'IndyAgent',
        recipientKeys: ['917a109d-eae3-42bc-9436-b02426d3ce2c', '348d5200-0f8f-42cc-aad9-61e0d082a674'],
        routingKeys: ['0094df0b-7b6d-4ebb-82de-234a621fb615'],
        priority: 10,
        serviceEndpoint: 'https://example.com',
      }
      const service = plainToInstance(IndyAgentService, json)

      expect(service).toMatchObject(json)
    })

    it('should correctly transform IndyAgentService class to Json', async () => {
      const json = {
        id: 'test-id',
        type: 'IndyAgent',
        recipientKeys: ['917a109d-eae3-42bc-9436-b02426d3ce2c', '348d5200-0f8f-42cc-aad9-61e0d082a674'],
        routingKeys: ['0094df0b-7b6d-4ebb-82de-234a621fb615'],
        priority: 10,
        serviceEndpoint: 'https://example.com',
      }

      const service = new IndyAgentService({
        ...json,
      })

      const transformed = instanceToPlain(service)

      expect(transformed).toEqual(json)
    })

    it("should set 'priority' to default (0) when not present in constructor or during transformation", async () => {
      const json = {
        id: 'test-id',
        type: 'IndyAgent',
        recipientKeys: ['917a109d-eae3-42bc-9436-b02426d3ce2c', '348d5200-0f8f-42cc-aad9-61e0d082a674'],
        routingKeys: ['0094df0b-7b6d-4ebb-82de-234a621fb615'],
        serviceEndpoint: 'https://example.com',
      }

      const transformService = plainToInstance(IndyAgentService, json)
      const constructorService = new IndyAgentService({ ...json })

      expect(transformService.priority).toBe(0)
      expect(constructorService.priority).toBe(0)

      expect(instanceToPlain(transformService).priority).toBe(0)
      expect(instanceToPlain(constructorService).priority).toBe(0)
    })
  })

  describe('DidCommService', () => {
    it('should correctly transform Json to DidCommService class', async () => {
      const json = {
        id: 'test-id',
        type: 'did-communication',
        recipientKeys: ['917a109d-eae3-42bc-9436-b02426d3ce2c', '348d5200-0f8f-42cc-aad9-61e0d082a674'],
        routingKeys: ['0094df0b-7b6d-4ebb-82de-234a621fb615'],
        accept: ['media-type'],
        priority: 10,
        serviceEndpoint: 'https://example.com',
      }
      const service = plainToInstance(DidCommService, json)

      expect(service).toMatchObject(json)
    })

    it('should correctly transform DidCommService class to Json', async () => {
      const json = {
        id: 'test-id',
        type: 'did-communication',
        recipientKeys: ['917a109d-eae3-42bc-9436-b02426d3ce2c', '348d5200-0f8f-42cc-aad9-61e0d082a674'],
        routingKeys: ['0094df0b-7b6d-4ebb-82de-234a621fb615'],
        accept: ['media-type'],
        priority: 10,
        serviceEndpoint: 'https://example.com',
      }

      const service = new DidCommService({
        ...json,
      })

      const transformed = instanceToPlain(service)

      expect(transformed).toEqual(json)
    })

    it("should set 'priority' to default (0) when not present in constructor or during transformation", async () => {
      const json = {
        id: 'test-id',
        type: 'did-communication',
        recipientKeys: ['917a109d-eae3-42bc-9436-b02426d3ce2c', '348d5200-0f8f-42cc-aad9-61e0d082a674'],
        routingKeys: ['0094df0b-7b6d-4ebb-82de-234a621fb615'],
        accept: ['media-type'],
        serviceEndpoint: 'https://example.com',
      }

      const transformService = plainToInstance(DidCommService, json)
      const constructorService = new DidCommService({ ...json })

      expect(transformService.priority).toBe(0)
      expect(constructorService.priority).toBe(0)

      expect(instanceToPlain(transformService).priority).toBe(0)
      expect(instanceToPlain(constructorService).priority).toBe(0)
    })
  })

  describe('ServiceTransformer', () => {
    class ServiceTransformerTest {
      @ServiceTransformer()
      public service: Service[] = []
    }

    it("should transform Json to default Service class when the 'type' key is not present in 'serviceTypes'", async () => {
      const serviceJson = {
        id: 'test-id',
        type: 'Mediator',
        serviceEndpoint: 'https://example.com',
      }

      const serviceWrapperJson = {
        service: [serviceJson],
      }
      const serviceWrapper = plainToInstance(ServiceTransformerTest, serviceWrapperJson)

      expect(serviceWrapper.service.length).toBe(1)

      const firstService = serviceWrapper.service[0]
      expect(firstService).toBeInstanceOf(Service)
      expect(firstService.id).toBe(serviceJson.id)
      expect(firstService.type).toBe(serviceJson.type)
      expect(firstService.serviceEndpoint).toBe(serviceJson.serviceEndpoint)
    })

    it("should transform Json to corresponding class when the 'type' key is present in 'serviceTypes'", async () => {
      const serviceArray = [
        {
          id: 'test-id',
          type: 'IndyAgent',
          recipientKeys: ['917a109d-eae3-42bc-9436-b02426d3ce2c', '348d5200-0f8f-42cc-aad9-61e0d082a674'],
          routingKeys: ['0094df0b-7b6d-4ebb-82de-234a621fb615'],
          priority: 10,
          serviceEndpoint: 'https://example.com',
        },
      ]

      const serviceWrapperJson = {
        service: serviceArray,
      }
      const serviceWrapper = plainToInstance(ServiceTransformerTest, serviceWrapperJson)

      expect(serviceWrapper.service.length).toBe(serviceArray.length)

      serviceArray.forEach((serviceJson, i) => {
        const service = serviceWrapper.service[i]
        expect(service).toBeInstanceOf(serviceTypes[serviceJson.type])
      })
    })
  })
})
