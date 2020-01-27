export enum PublicKeyType {
  RSA_SIG_2018 = 'RsaVerificationKey2018|RsaSignatureAuthentication2018|publicKeyPem',
  ED25519_SIG_2018 = 'Ed25519VerificationKey2018|Ed25519SignatureAuthentication2018|publicKeyBase58',
  EDDSA_SA_SIG_SECP256K1 = 'Secp256k1VerificationKey2018|Secp256k1SignatureAuthenticationKey2018|publicKeyHex',
}

export interface Authentication {
  type: string;
  publicKey: string;
}

export class DidDoc {
  '@context': string;
  id: string;
  publicKey: PublicKey[];
  service: Service[];

  constructor(id: string, publicKey: PublicKey[], service: Service[]) {
    this['@context'] = 'https://w3id.org/did/v1';
    this.id = id;
    this.publicKey = publicKey;
    this.service = service;
  }

  toJSON() {
    const publicKey = this.publicKey.map(element => element.toJSON());
    const authentication = this.publicKey.map(pk => {
      if (pk.authn) {
        const [ver_type, auth_type, specifier] = pk.type.split('|');
        return {
          type: auth_type,
          publicKey: pk.id,
        };
      }
    });
    const service = this.service.map(s => s.toJSON());
    return {
      '@context': this['@context'],
      id: this.id,
      publicKey,
      authentication,
      service,
    };
  }

  serialize() {
    return JSON.stringify(this.toJSON());
  }

  static deserialize(doc: string): DidDoc {
    const json = JSON.parse(doc);
    const authentication = new Set(json.authentication);
    const publicKey = (json.publicKey as [{ [key: string]: any }]).map(pk => {
      return PublicKey.fromJSON(pk, authentication.has(pk.id));
    });
    const service = (json.service as [{ [key: string]: any }]).map(s => Service.fromJSON(s));
    const didDoc = new DidDoc(json.id, publicKey, service);
    return didDoc;
  }
}

export class PublicKey {
  id: string;
  type: PublicKeyType;
  controller: string;
  value: string;
  authn: boolean;

  constructor(id: string, type: PublicKeyType, controller: string, value: string, authn: boolean = false) {
    this.id = id;
    this.type = type;
    this.controller = controller;
    this.value = value;
    this.authn = authn;
  }

  serialize(): string {
    return JSON.stringify(this.toJSON());
  }

  toJSON() {
    // @ts-ignore
    const [ver_type, auth_type, specifier] = PublicKeyType[this.type].split('|');
    return {
      id: this.id,
      type: ver_type,
      controller: this.controller,
      [specifier]: this.value,
    };
  }

  static deserialize(pk: string, authn: boolean): PublicKey {
    const json = JSON.parse(pk);
    return PublicKey.fromJSON(json, authn);
  }

  static fromJSON(pk: { [key: string]: string }, authn: boolean): PublicKey {
    const _type: PublicKeyType = Object.keys(PublicKeyType)
      // @ts-ignore
      .map(t => [PublicKeyType[t].split('|')[0], t])
      .filter(verkeyType => verkeyType[0] == pk.type)[0][1];
    const specifier = _type.split('|')[2];
    return new PublicKey(pk.id, _type, pk.controller, pk[`${specifier}`], authn);
  }
}

export class Service {
  id: string;
  serviceEndpoint: string;
  recipientKeys: string[];
  routingKeys: string[];
  type: string;
  priority: number = 0;

  constructor(
    id: string,
    serviceEndpoint: string,
    recipientKeys: Verkey[] = [],
    routingKeys: Verkey[] = [],
    priority: number = 0,
    type: string
  ) {
    this.id = id;
    this.serviceEndpoint = serviceEndpoint;
    this.recipientKeys = recipientKeys;
    this.routingKeys = routingKeys;
    this.priority = priority;
    this.type = type;
  }

  static deserialize(serviceDoc: string): Service {
    return Service.fromJSON(JSON.parse(serviceDoc));
  }

  static fromJSON(serviceDoc: { [key: string]: any }) {
    const { id, serviceEndpoint, type, priority, recipientKeys, routingKeys } = serviceDoc;
    return new Service(id, serviceEndpoint, recipientKeys, routingKeys, priority || 0, type);
  }

  toJSON(): {} {
    const res: { [key: string]: any } = {
      id: this.id,
      type: this.type,
      priority: this.priority,
      serviceEndpoint: this.serviceEndpoint,
    };

    if (this.recipientKeys) {
      res['recipientKeys'] = this.recipientKeys;
    }
    if (this.routingKeys) {
      res['routingKeys'] = this.routingKeys;
    }
    return res;
  }
}
