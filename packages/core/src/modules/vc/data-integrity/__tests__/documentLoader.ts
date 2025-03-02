import type { AgentContext } from '../../../../agent/context/AgentContext'
import type { JsonObject } from '../../../../types'
import type { DocumentLoaderResult } from '../libraries/jsonld'

import { isDid } from '../../../../utils'
import { DID_EXAMPLE_48939859 } from '../../__tests__/dids/did_example_489398593'
import { DID_SOV_QqEfJxe752NCmWqR5TssZ5 } from '../../__tests__/dids/did_sov_QqEfJxe752NCmWqR5TssZ5'
import { DID_WEB_LAUNCHPAD } from '../../__tests__/dids/did_web_launchpad'
import { DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL } from '../../__tests__/dids/did_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL'
import { DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV } from '../../__tests__/dids/did_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV'
import { DID_zUC7DMETzdZM6woUjvs2fieEyFTbHABXwBvLYPBs4NDWKut4H41h8V3KTqGNRUziXLYqa1sFYYw9Zjpt6pFUf7hra4Q1zXMA9JjXcXxDpxuDNpUKEpiDPSYYUztVchUJHQJJhox } from '../../__tests__/dids/did_zUC7DMETzdZM6woUjvs2fieEyFTbHABXwBvLYPBs4NDWKut4H41h8V3KTqGNRUziXLYqa1sFYYw9Zjpt6pFUf7hra4Q1zXMA9JjXcXxDpxuDNpUKEpiDPSYYUztVchUJHQJJhox'
import { DID_zUC7F9Jt6YzVW9fGhwYjVrjdS8Xzg7oQc2CeDcVNgEcEAaJXAtPz3eXu2sewq4xtwRK3DAhQRYwwoYiT3nNzLCPsrKoP72UGZKhh4cNuZD7RkmwzAa1Bye4C5a9DcyYBGKZrE5F } from '../../__tests__/dids/did_zUC7F9Jt6YzVW9fGhwYjVrjdS8Xzg7oQc2CeDcVNgEcEAaJXAtPz3eXu2sewq4xtwRK3DAhQRYwwoYiT3nNzLCPsrKoP72UGZKhh4cNuZD7RkmwzAa1Bye4C5a9DcyYBGKZrE5F'
import { DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4 } from '../../__tests__/dids/did_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4'
import { DID_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa } from '../../__tests__/dids/did_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa'
import { DID_zUC72to2eJiFMrt8a89LoaEPHC76QcfAxQdFys3nFGCmDKAmLbdE4ByyQ54kh42XgECCyZfVKe3m41Kk35nzrBKYbk6s9K7EjyLJcGGPkA7N15tDNBQJaY7cHD4RRaTwF6qXpmD } from '../../__tests__/dids/did_zUC72to2eJiFMrt8a89LoaEPHC76QcfAxQdFys3nFGCmDKAmLbdE4ByyQ54kh42XgECCyZfVKe3m41Kk35nzrBKYbk6s9K7EjyLJcGGPkA7N15tDNBQJaY7cHD4RRaTwF6qXpmD'
import { DID_zUC73JKGpX1WG4CWbFM15ni3faANPet6m8WJ6vaF5xyFsM3MeoBVNgQ6jjVPCcUnTAnJy6RVKqsUXa4AvdRKwV5hhQhwhMWFT9so9jrPekKmqpikTjYBXa3RYWqRpCWHY4u4hxh } from '../../__tests__/dids/did_zUC73JKGpX1WG4CWbFM15ni3faANPet6m8WJ6vaF5xyFsM3MeoBVNgQ6jjVPCcUnTAnJy6RVKqsUXa4AvdRKwV5hhQhwhMWFT9so9jrPekKmqpikTjYBXa3RYWqRpCWHY4u4hxh'
import { DID_zUC73YqdRJ3t8bZsFUoxYFPNVruHzn4o7u78GSrMXVSkcb3xAYtUxRD2kSt2bDcmQpRjKfygwLJ1HEGfkosSN7gr4acjGkXLbLRXREueknFN4AU19m8BxEgWnLM84CAvsw6bhYn } from '../../__tests__/dids/did_zUC73YqdRJ3t8bZsFUoxYFPNVruHzn4o7u78GSrMXVSkcb3xAYtUxRD2kSt2bDcmQpRjKfygwLJ1HEGfkosSN7gr4acjGkXLbLRXREueknFN4AU19m8BxEgWnLM84CAvsw6bhYn'
import { DID_zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN } from '../../__tests__/dids/did_zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN'
import { DID_zUC76qMTDAaupy19pEk8JKH5LJwPwmscNQn24SYpqrgqEoYWPFgCSm4CnTfupADRfbB6CxdwYhVaTFjT4fmPvMh7gWY87LauhaLmNpPamCv4LAepcRfBDndSdtCpZKSTELMjzGJ } from '../../__tests__/dids/did_zUC76qMTDAaupy19pEk8JKH5LJwPwmscNQn24SYpqrgqEoYWPFgCSm4CnTfupADRfbB6CxdwYhVaTFjT4fmPvMh7gWY87LauhaLmNpPamCv4LAepcRfBDndSdtCpZKSTELMjzGJ'
import { SECURITY_CONTEXT_V3_URL } from '../../constants'
import { DEFAULT_CONTEXTS } from '../libraries/contexts'
import jsonld from '../libraries/jsonld'

import { EXAMPLES_V1, VACCINATION_V1, VACCINATION_V2 } from './contexts'
import { CITIZENSHIP_V1 } from './contexts/citizenship_v1'
import { CITIZENSHIP_V2 } from './contexts/citizenship_v2'
import { MATTR_VC_EXTENSION_V1 } from './contexts/mattr_vc_extension_v1'
import { SECURITY_V3_UNSTABLE } from './contexts/security_v3_unstable'

export const DOCUMENTS = {
  ...DEFAULT_CONTEXTS,
  [DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL.id]: DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL,
  [DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV.id]: DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV,
  [DID_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa.id]:
    DID_zUC72Q7XD4PE4CrMiDVXuvZng3sBvMmaGgNeTUJuzavH2BS7ThbHL9FhsZM9QYY5fqAQ4MB8M9oudz3tfuaX36Ajr97QRW7LBt6WWmrtESe6Bs5NYzFtLWEmeVtvRYVAgjFcJSa,
  [DID_EXAMPLE_48939859.id]: DID_EXAMPLE_48939859,
  [DID_zUC73JKGpX1WG4CWbFM15ni3faANPet6m8WJ6vaF5xyFsM3MeoBVNgQ6jjVPCcUnTAnJy6RVKqsUXa4AvdRKwV5hhQhwhMWFT9so9jrPekKmqpikTjYBXa3RYWqRpCWHY4u4hxh.id]:
    DID_zUC73JKGpX1WG4CWbFM15ni3faANPet6m8WJ6vaF5xyFsM3MeoBVNgQ6jjVPCcUnTAnJy6RVKqsUXa4AvdRKwV5hhQhwhMWFT9so9jrPekKmqpikTjYBXa3RYWqRpCWHY4u4hxh,
  [DID_zUC73YqdRJ3t8bZsFUoxYFPNVruHzn4o7u78GSrMXVSkcb3xAYtUxRD2kSt2bDcmQpRjKfygwLJ1HEGfkosSN7gr4acjGkXLbLRXREueknFN4AU19m8BxEgWnLM84CAvsw6bhYn.id]:
    DID_zUC73YqdRJ3t8bZsFUoxYFPNVruHzn4o7u78GSrMXVSkcb3xAYtUxRD2kSt2bDcmQpRjKfygwLJ1HEGfkosSN7gr4acjGkXLbLRXREueknFN4AU19m8BxEgWnLM84CAvsw6bhYn,
  [DID_zUC76qMTDAaupy19pEk8JKH5LJwPwmscNQn24SYpqrgqEoYWPFgCSm4CnTfupADRfbB6CxdwYhVaTFjT4fmPvMh7gWY87LauhaLmNpPamCv4LAepcRfBDndSdtCpZKSTELMjzGJ.id]:
    DID_zUC76qMTDAaupy19pEk8JKH5LJwPwmscNQn24SYpqrgqEoYWPFgCSm4CnTfupADRfbB6CxdwYhVaTFjT4fmPvMh7gWY87LauhaLmNpPamCv4LAepcRfBDndSdtCpZKSTELMjzGJ,
  [DID_zUC7DMETzdZM6woUjvs2fieEyFTbHABXwBvLYPBs4NDWKut4H41h8V3KTqGNRUziXLYqa1sFYYw9Zjpt6pFUf7hra4Q1zXMA9JjXcXxDpxuDNpUKEpiDPSYYUztVchUJHQJJhox.id]:
    DID_zUC7DMETzdZM6woUjvs2fieEyFTbHABXwBvLYPBs4NDWKut4H41h8V3KTqGNRUziXLYqa1sFYYw9Zjpt6pFUf7hra4Q1zXMA9JjXcXxDpxuDNpUKEpiDPSYYUztVchUJHQJJhox,
  [DID_zUC7F9Jt6YzVW9fGhwYjVrjdS8Xzg7oQc2CeDcVNgEcEAaJXAtPz3eXu2sewq4xtwRK3DAhQRYwwoYiT3nNzLCPsrKoP72UGZKhh4cNuZD7RkmwzAa1Bye4C5a9DcyYBGKZrE5F.id]:
    DID_zUC7F9Jt6YzVW9fGhwYjVrjdS8Xzg7oQc2CeDcVNgEcEAaJXAtPz3eXu2sewq4xtwRK3DAhQRYwwoYiT3nNzLCPsrKoP72UGZKhh4cNuZD7RkmwzAa1Bye4C5a9DcyYBGKZrE5F,
  [DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4.id]:
    DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4,
  [DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4.id]:
    DID_zUC7H7TxvhWmvfptpu2zSwo5EZ1kr3MPNsjovaD2ipbuzj6zi1vk4FHTiunCJrFvUYV77Mk3QcWUUAHojPZdU8oG476cvMK2ozP1gVq63x5ovj6e4oQ9qg9eF4YjPhWJs6FPuT4,
  [DID_zUC72to2eJiFMrt8a89LoaEPHC76QcfAxQdFys3nFGCmDKAmLbdE4ByyQ54kh42XgECCyZfVKe3m41Kk35nzrBKYbk6s9K7EjyLJcGGPkA7N15tDNBQJaY7cHD4RRaTwF6qXpmD.id]:
    DID_zUC72to2eJiFMrt8a89LoaEPHC76QcfAxQdFys3nFGCmDKAmLbdE4ByyQ54kh42XgECCyZfVKe3m41Kk35nzrBKYbk6s9K7EjyLJcGGPkA7N15tDNBQJaY7cHD4RRaTwF6qXpmD,
  [DID_zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN.id]:
    DID_zUC74VEqqhEHQcgv4zagSPkqFJxuNWuoBPKjJuHETEUeHLoSqWt92viSsmaWjy82y2cgguc8e9hsGBifnVK67pQ4gve3m6iSboDkmJjxVEb1d6mRAx5fpMAejooNzNqqbTMVeUN,
  [DID_SOV_QqEfJxe752NCmWqR5TssZ5.id]: DID_SOV_QqEfJxe752NCmWqR5TssZ5,
  [DID_WEB_LAUNCHPAD.id]: DID_WEB_LAUNCHPAD,
  [SECURITY_CONTEXT_V3_URL]: SECURITY_V3_UNSTABLE,
  'https://www.w3.org/2018/credentials/examples/v1': EXAMPLES_V1,
  'https://w3id.org/citizenship/v1': CITIZENSHIP_V1,
  'https://w3id.org/citizenship/v2': CITIZENSHIP_V2,
  'https://w3id.org/vaccination/v1': VACCINATION_V1,
  'https://w3id.org/vaccination/v2': VACCINATION_V2,
  'https://mattr.global/contexts/vc-extensions/v1': MATTR_VC_EXTENSION_V1,
}

async function _customDocumentLoader(url: string): Promise<DocumentLoaderResult> {
  let result = DOCUMENTS[url as keyof typeof DOCUMENTS]

  if (!result) {
    const withoutFragment = url.split('#')[0]
    result = DOCUMENTS[withoutFragment as keyof typeof DOCUMENTS]
  }

  if (!result) {
    throw new Error(`Document not found: ${url}`)
  }

  if (isDid(url)) {
    result = await jsonld.frame(
      result,
      {
        '@context': result['@context'],
        '@embed': '@never',
        id: url,
      },
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

export const customDocumentLoader = (_agentContext?: AgentContext) => _customDocumentLoader.bind(_customDocumentLoader)
