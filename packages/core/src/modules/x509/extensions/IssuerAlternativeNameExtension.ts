import type { Extension as AsnExtension } from '@peculiar/asn1-x509'
import type { JsonGeneralNames, TextObject } from '@peculiar/x509'

import { AsnConvert } from '@peculiar/asn1-schema'
import { id_ce_issuerAltName, IssueAlternativeName } from '@peculiar/asn1-x509'
import { Extension, GeneralNames, ExtensionFactory } from '@peculiar/x509'

export class IssuerAlternativeNameExtension extends Extension {
  public names!: GeneralNames

  public static override NAME = 'Issuer Alternative Name'

  public constructor(data: JsonGeneralNames | ArrayBufferLike, critical?: boolean) {
    if (data instanceof ArrayBuffer) {
      super(data)
    } else {
      super(id_ce_issuerAltName, !!critical, new GeneralNames(data).rawData)
    }
  }

  public onInit(asn: AsnExtension) {
    super.onInit(asn)
    const value = AsnConvert.parse(asn.extnValue, IssueAlternativeName)
    this.names = new GeneralNames(value)
  }

  public override toTextObject(): TextObject {
    const obj = this.toTextObjectWithoutValue()

    const namesObj = this.names.toTextObject()
    for (const key in namesObj) {
      obj[key] = namesObj[key]
    }

    return obj
  }
}

ExtensionFactory.register(id_ce_issuerAltName, IssuerAlternativeNameExtension)
