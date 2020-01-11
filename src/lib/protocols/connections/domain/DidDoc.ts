export interface DidDoc {
  '@context': string;
  service: Service[];
}

interface Service {
  serviceEndpoint: string;
  recipientKeys: Verkey[];
  routingKeys: Verkey[];
}
