import type { AgentContext } from '../../../agent/context/AgentContext'
import type { JsonObject } from '../../../types'
import type { DocumentLoaderResult } from '../libraries/jsonld'

import jsonld from '../libraries/jsonld'

import {
  BBS_V1,
  EXAMPLES_V1,
  ODRL,
  PRESENTATION_SUBMISSION,
  SCHEMA_ORG,
  VACCINATION_V1,
  VACCINATION_V2,
} from './contexts'
import { X25519_V1 } from './contexts/X25519_v1'
import { CITIZENSHIP_V1 } from './contexts/citizenship_v1'
import { CITIZENSHIP_V2 } from './contexts/citizenship_v2'
import { CREDENTIALS_V1 } from './contexts/credentials_v1'
import { DID_V1 } from './contexts/did_v1'
import { ED25519_V1 } from './contexts/ed25519_v1'
import { MATTR_VC_EXTENSION_V1 } from './contexts/mattr_vc_extension_v1'
import { PURL_OB_V3P0 } from './contexts/purl_ob_v3po'
import { SECURITY_V1 } from './contexts/security_v1'
import { SECURITY_V2 } from './contexts/security_v2'
import { SECURITY_V3_UNSTABLE } from './contexts/security_v3_unstable'
import { VC_REVOCATION_LIST_2020 } from './contexts/vc_revocation_list_2020'
import { DID_EXAMPLE_48939859 } from './dids/did_example_489398593'
import { DID_SOV_QqEfJxe752NCmWqR5TssZ5 } from './dids/did_sov_QqEfJxe752NCmWqR5TssZ5'
import { DID_WEB_LAUNCHPAD } from './dids/did_web_launchpad'
import { DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL } from './dids/did_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL'
import { DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV } from './dids/did_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV'
import { DID_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa } from './dids/did_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa'
import { DID_zUC72to2eJiFMrt8a89LoaEPHC76QcfAxQdFys3nFGCmDKAmLbdE4ByyQ54kh42XgECCyZfVKe3m41Kk35nzrBKYbk6s9K7EjyLJcGGPkA7N15tDNBQJaY7cHD4RRaTwF6qXpmD } from './dids/did_zUC72to2eJiFMrt8a89LoaEPHC76QcfAxQdFys3nFGCmDKAmLbdE4ByyQ54kh42XgECCyZfVKe3m41Kk35nzrBKYbk6s9K7EjyLJcGGPkA7N15tDNBQJaY7cHD4RRaTwF6qXpmD'
import { DID_zUC73JKGpX1WG4CWbFM15ni3faANPet6m8WJ6vaF5xyFsM3MeoBVNgQ6jjVPCcUnTAnJy6RVKqsUXa4AvdRKwV5hhQhwhMWFT9so9jrPekKmqpikTjYBXa3RYWqRpCWHY4u4hxh } from './dids/did_zUC73JKGpX1WG4CWbFM15ni3faANPet6m8WJ6vaF5xyFsM3MeoBVNgQ6jjVPCcUnTAnJy6RVKqsUXa4AvdRKwV5hhQhwhMWFT9so9jrPekKmqpikTjYBXa3RYWqRpCWHY4u4hxh'
import { DID_zUC73YqdRJ3t8bZsFUoxYFPNVruHzn4o7u78GSrMXVSkcb3xAYtUxRD2kSt2bDcmQpRjKfygwLJ1HEGfkosSN7gr4acjGkXLbLRXREueknFN4AU19m8BxEgWnLM84CAvsw6bhYn } from './dids/did_zUC73YqdRJ3t8bZsFUoxYFPNVruHzn4o7u78GSrMXVSkcb3xAYtUxRD2kSt2bDcmQpRjKfygwLJ1HEGfkosSN7gr4acjGkXLbLRXREueknFN4AU19m8BxEgWnLM84CAvsw6bhYn'
import { DID_zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN } from './dids/did_zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN'
import { DID_zUC76qMTDAaupy19pEk8JKH5LJwPwmscNQn24SYpqrgqEoYWPFgCSm4CnTfupADRfbB6CxdwYhVaTFjT4fmPvMh7gWY87LauhaLmNpPamCv4LAepcRfBDndSdtCpZKSTELMjzGJ } from './dids/did_zUC76qMTDAaupy19pEk8JKH5LJwPwmscNQn24SYpqrgqEoYWPFgCSm4CnTfupADRfbB6CxdwYhVaTFjT4fmPvMh7gWY87LauhaLmNpPamCv4LAepcRfBDndSdtCpZKSTELMjzGJ'
import { DID_zUC7DMETzdZM6woUjvs2fieEyFTbHABXwBvLYPBs4NDWKut4H41h8V3KTqGNRUziXLYqa1sFYYw9Zjpt6pFUf7hra4Q1zXMA9JjXcXxDpxuDNpUKEpiDPSYYUztVchUJHQJJhox } from './dids/did_zUC7DMETzdZM6woUjvs2fieEyFTbHABXwBvLYPBs4NDWKut4H41h8V3KTqGNRUziXLYqa1sFYYw9Zjpt6pFUf7hra4Q1zXMA9JjXcXxDpxuDNpUKEpiDPSYYUztVchUJHQJJhox'
import { DID_zUC7F9Jt6YzVW9fGhwYjVrjdS8Xzg7oQc2CeDcVNgEcEAaJXAtPz3eXu2sewq4xtwRK3DAhQRYwwoYiT3nNzLCPsrKoP72UGZKhh4cNuZD7RkmwzAa1Bye4C5a9DcyYBGKZrE5F } from './dids/did_zUC7F9Jt6YzVW9fGhwYjVrjdS8Xzg7oQc2CeDcVNgEcEAaJXAtPz3eXu2sewq4xtwRK3DAhQRYwwoYiT3nNzLCPsrKoP72UGZKhh4cNuZD7RkmwzAa1Bye4C5a9DcyYBGKZrE5F'
import { DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4 } from './dids/did_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4'

export const DOCUMENTS = {
  [DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL['id']]: DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL,
  [DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV['id']]: DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV,
  [DID_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa[
    'id'
  ]]:
    DID_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa,
  [DID_EXAMPLE_48939859['id']]: DID_EXAMPLE_48939859,
  [DID_zUC73JKGpX1WG4CWbFM15ni3faANPet6m8WJ6vaF5xyFsM3MeoBVNgQ6jjVPCcUnTAnJy6RVKqsUXa4AvdRKwV5hhQhwhMWFT9so9jrPekKmqpikTjYBXa3RYWqRpCWHY4u4hxh[
    'id'
  ]]:
    DID_zUC73JKGpX1WG4CWbFM15ni3faANPet6m8WJ6vaF5xyFsM3MeoBVNgQ6jjVPCcUnTAnJy6RVKqsUXa4AvdRKwV5hhQhwhMWFT9so9jrPekKmqpikTjYBXa3RYWqRpCWHY4u4hxh,
  [DID_zUC73YqdRJ3t8bZsFUoxYFPNVruHzn4o7u78GSrMXVSkcb3xAYtUxRD2kSt2bDcmQpRjKfygwLJ1HEGfkosSN7gr4acjGkXLbLRXREueknFN4AU19m8BxEgWnLM84CAvsw6bhYn[
    'id'
  ]]:
    DID_zUC73YqdRJ3t8bZsFUoxYFPNVruHzn4o7u78GSrMXVSkcb3xAYtUxRD2kSt2bDcmQpRjKfygwLJ1HEGfkosSN7gr4acjGkXLbLRXREueknFN4AU19m8BxEgWnLM84CAvsw6bhYn,
  [DID_zUC76qMTDAaupy19pEk8JKH5LJwPwmscNQn24SYpqrgqEoYWPFgCSm4CnTfupADRfbB6CxdwYhVaTFjT4fmPvMh7gWY87LauhaLmNpPamCv4LAepcRfBDndSdtCpZKSTELMjzGJ[
    'id'
  ]]:
    DID_zUC76qMTDAaupy19pEk8JKH5LJwPwmscNQn24SYpqrgqEoYWPFgCSm4CnTfupADRfbB6CxdwYhVaTFjT4fmPvMh7gWY87LauhaLmNpPamCv4LAepcRfBDndSdtCpZKSTELMjzGJ,
  [DID_zUC7DMETzdZM6woUjvs2fieEyFTbHABXwBvLYPBs4NDWKut4H41h8V3KTqGNRUziXLYqa1sFYYw9Zjpt6pFUf7hra4Q1zXMA9JjXcXxDpxuDNpUKEpiDPSYYUztVchUJHQJJhox[
    'id'
  ]]:
    DID_zUC7DMETzdZM6woUjvs2fieEyFTbHABXwBvLYPBs4NDWKut4H41h8V3KTqGNRUziXLYqa1sFYYw9Zjpt6pFUf7hra4Q1zXMA9JjXcXxDpxuDNpUKEpiDPSYYUztVchUJHQJJhox,
  [DID_zUC7F9Jt6YzVW9fGhwYjVrjdS8Xzg7oQc2CeDcVNgEcEAaJXAtPz3eXu2sewq4xtwRK3DAhQRYwwoYiT3nNzLCPsrKoP72UGZKhh4cNuZD7RkmwzAa1Bye4C5a9DcyYBGKZrE5F[
    'id'
  ]]:
    DID_zUC7F9Jt6YzVW9fGhwYjVrjdS8Xzg7oQc2CeDcVNgEcEAaJXAtPz3eXu2sewq4xtwRK3DAhQRYwwoYiT3nNzLCPsrKoP72UGZKhh4cNuZD7RkmwzAa1Bye4C5a9DcyYBGKZrE5F,
  [DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4[
    'id'
  ]]:
    DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4,
  [DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4[
    'id'
  ]]:
    DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4,
  [DID_zUC72to2eJiFMrt8a89LoaEPHC76QcfAxQdFys3nFGCmDKAmLbdE4ByyQ54kh42XgECCyZfVKe3m41Kk35nzrBKYbk6s9K7EjyLJcGGPkA7N15tDNBQJaY7cHD4RRaTwF6qXpmD[
    'id'
  ]]:
    DID_zUC72to2eJiFMrt8a89LoaEPHC76QcfAxQdFys3nFGCmDKAmLbdE4ByyQ54kh42XgECCyZfVKe3m41Kk35nzrBKYbk6s9K7EjyLJcGGPkA7N15tDNBQJaY7cHD4RRaTwF6qXpmD,
  [DID_zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN[
    'id'
  ]]:
    DID_zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN,
  [DID_SOV_QqEfJxe752NCmWqR5TssZ5['id']]: DID_SOV_QqEfJxe752NCmWqR5TssZ5,
  [DID_WEB_LAUNCHPAD['id']]: DID_WEB_LAUNCHPAD,
  SECURITY_CONTEXT_V1_URL: SECURITY_V1,
  SECURITY_CONTEXT_V2_URL: SECURITY_V2,
  SECURITY_CONTEXT_V3_URL: SECURITY_V3_UNSTABLE,
  DID_V1_CONTEXT_URL: DID_V1,
  CREDENTIALS_CONTEXT_V1_URL: CREDENTIALS_V1,
  SECURITY_CONTEXT_BBS_URL: BBS_V1,
  'https://w3id.org/security/suites/bls12381-2020/v1': BBS_V1,
  'https://w3id.org/security/bbs/v1': BBS_V1,
  'https://w3id.org/security/v1': SECURITY_V1,
  'https://w3id.org/security/v2': SECURITY_V2,
  'https://w3id.org/security/suites/x25519-2019/v1': X25519_V1,
  'https://w3id.org/security/suites/ed25519-2018/v1': ED25519_V1,
  'https://www.w3.org/2018/credentials/examples/v1': EXAMPLES_V1,
  'https://www.w3.org/2018/credentials/v1': CREDENTIALS_V1,
  'https://w3id.org/did/v1': DID_V1,
  'https://www.w3.org/ns/did/v1': DID_V1,
  'https://w3.org/ns/did/v1': DID_V1,
  'https://w3id.org/citizenship/v1': CITIZENSHIP_V1,
  'https://w3id.org/citizenship/v2': CITIZENSHIP_V2,
  'https://www.w3.org/ns/odrl.jsonld': ODRL,
  'http://schema.org/': SCHEMA_ORG,
  'https://w3id.org/vaccination/v1': VACCINATION_V1,
  'https://w3id.org/vaccination/v2': VACCINATION_V2,
  'https://identity.foundation/presentation-exchange/submission/v1': PRESENTATION_SUBMISSION,
  'https://mattr.global/contexts/vc-extensions/v1': MATTR_VC_EXTENSION_V1,
  'https://purl.imsglobal.org/spec/ob/v3p0/context.json': PURL_OB_V3P0,
  'https://w3c-ccg.github.io/vc-status-rl-2020/contexts/vc-revocation-list-2020/v1.jsonld': VC_REVOCATION_LIST_2020,
}

async function _customDocumentLoader(url: string): Promise<DocumentLoaderResult> {
  let result = DOCUMENTS[url]

  if (!result) {
    const withoutFragment = url.split('#')[0]
    result = DOCUMENTS[withoutFragment]
  }

  if (!result) {
    throw new Error(`Document not found: ${url}`)
  }

  if (url.startsWith('did:')) {
    result = await jsonld.frame(
      result,
      {
        '@context': result['@context'],
        '@embed': '@never',
        id: url,
      },
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      { documentLoader: this }
    )
  }

  return {
    contextUrl: null,
    documentUrl: url,
    document: result as JsonObject,
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const customDocumentLoader = (agentContext?: AgentContext) => _customDocumentLoader.bind(_customDocumentLoader)
