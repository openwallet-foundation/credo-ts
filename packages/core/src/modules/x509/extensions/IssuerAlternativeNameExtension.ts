import type { TextObject } from '@peculiar/x509'

import { id_ce_issuerAltName, id_ce_subjectAltName } from '@peculiar/asn1-x509'
import { Extension, GeneralNames, ExtensionFactory } from '@peculiar/x509'

export class IssuerAlternativeNameExtension extends Extension {
  public names!: GeneralNames

  public static override NAME = 'Issuer Alternative Name'

  public constructor(...args: unknown[]) {
    super(id_ce_subjectAltName, args[1] as boolean, new GeneralNames(args[0] || []).rawData)
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
