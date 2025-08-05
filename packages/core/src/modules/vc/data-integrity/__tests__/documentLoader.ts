import type { AgentContext } from '../../../../agent/context/AgentContext'
import type { JsonObject } from '../../../../types'
import type { DocumentLoaderResult } from '../libraries/jsonld'

import { isDid } from '../../../../utils'
import { DID_SOV_QqEfJxe752NCmWqR5TssZ5 } from '../../__tests__/dids/did_sov_QqEfJxe752NCmWqR5TssZ5'
import { DID_WEB_LAUNCHPAD } from '../../__tests__/dids/did_web_launchpad'
import { DID_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL } from '../../__tests__/dids/did_z6Mkgg342Ycpuk263R9d8Aq6MUaxPn1DDeHyGo38EefXmgDL'
import { DID_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV } from '../../__tests__/dids/did_z6MkvePyWAApUVeDboZhNbckaWHnqtD6pCETd6xoqGbcpEBV'

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
