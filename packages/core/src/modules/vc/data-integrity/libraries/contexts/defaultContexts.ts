import { CREDENTIALS_V1 } from './credentials_v1'
import { DATA_INTEGRITY_V2 } from './dataIntegrity_v2'
import { DID_V1 } from './did_v1'
import { ED25519_V1 } from './ed25519_v1'
import { LINKED_VP_V1 } from './linkedvp_v1'
import { ODRL } from './odrl'
import { PURL_OB_V3P0 } from './purl_ob_v3po'
import { SCHEMA_ORG } from './schema_org'
import { SECP256K1_V1 } from './secp256k1_v1'
import { SECURITY_V1 } from './security_v1'
import { SECURITY_V2 } from './security_v2'
import { PRESENTATION_SUBMISSION } from './submission'
import { VC_REVOCATION_LIST_2020 } from './vc_revocation_list_2020'
import { X25519_V1 } from './X25519_v1'

export const DEFAULT_CONTEXTS = {
  'https://w3id.org/security/v1': SECURITY_V1,
  'https://w3id.org/security/v2': SECURITY_V2,
  'https://w3id.org/security/suites/x25519-2019/v1': X25519_V1,
  'https://w3id.org/security/suites/ed25519-2018/v1': ED25519_V1,
  'https://w3id.org/security/suites/secp256k1-2019/v1': SECP256K1_V1,
  'https://www.w3.org/2018/credentials/v1': CREDENTIALS_V1,
  'https://w3id.org/did/v1': DID_V1,
  'https://www.w3.org/ns/did/v1': DID_V1,
  'https://w3.org/ns/did/v1': DID_V1,
  'https://www.w3.org/ns/odrl.jsonld': ODRL,
  'http://schema.org/': SCHEMA_ORG,
  'https://identity.foundation/presentation-exchange/submission/v1': PRESENTATION_SUBMISSION,
  'https://purl.imsglobal.org/spec/ob/v3p0/context.json': PURL_OB_V3P0,
  'https://w3c-ccg.github.io/vc-status-rl-2020/contexts/vc-revocation-list-2020/v1.jsonld': VC_REVOCATION_LIST_2020,
  'https://w3id.org/security/data-integrity/v2': DATA_INTEGRITY_V2,
  'https://identity.foundation/linked-vp/contexts/v1': LINKED_VP_V1,
}
