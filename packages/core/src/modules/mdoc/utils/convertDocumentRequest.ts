import type { DocRequest } from '@verifiables/request-converter'
import type { MdocDocumentRequest } from '../MdocOptions'

export const convertDocumentRequest = (documentRequests: DocRequest[]): MdocDocumentRequest[] =>
  documentRequests.map((dr) => ({
    docType: dr.itemsRequest.docType,
    nameSpaces: dr.itemsRequest.nameSpaces,
  }))
