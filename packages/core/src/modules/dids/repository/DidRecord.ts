import { Type } from 'class-transformer'
import { IsEnum, ValidateNested } from 'class-validator'
import type { TagsBase } from '../../../storage/BaseRecord'
import { BaseRecord } from '../../../storage/BaseRecord'
import { uuid } from '../../../utils/uuid'
import { Ed25519PublicJwk, type PublicJwk, X25519PublicJwk } from '../../kms'
import type { DidDocumentKey } from '../DidsApiOptions'
import { DidDocument } from '../domain'
import { findMatchingEd25519Key } from '../findMatchingEd25519Key'
import { DidDocumentRole } from '../domain/DidDocumentRole'
import { parseDid } from '../domain/parse'
import type { DidRecordMetadata } from './didRecordMetadataTypes'
import { DidRecordMetadataKeys } from './didRecordMetadataTypes'

export interface DidRecordProps {
  id?: string
  did: string
  role: DidDocumentRole
  didDocument?: DidDocument
  createdAt?: Date
  tags?: CustomDidTags

  /**
   * The kms key ids associated with the did record. Should only be used
   * when role is {@link DidDocumentRole.Created}
   */
  keys?: DidDocumentKey[]
}

export interface CustomDidTags extends TagsBase {
  recipientKeyFingerprints?: string[]

  // Alternative forms of the did, allowed to be queried by them.
  // Relationship must be verified both ways before setting this tag.
  alternativeDids?: string[]
}

type DefaultDidTags = {
  // We set the recipientKeyFingeprints as a default tag, if the did record has a did document
  // If the did record does not have a did document, we can't calculate it, and it needs to be
  // handled by the creator of the did record
  recipientKeyFingerprints?: string[]

  role: DidDocumentRole
  method: string
  legacyUnqualifiedDid?: string
  methodSpecificIdentifier: string
  did: string
}

export class DidRecord extends BaseRecord<DefaultDidTags, CustomDidTags, DidRecordMetadata> implements DidRecordProps {
  @Type(() => DidDocument)
  @ValidateNested()
  public didDocument?: DidDocument

  public did!: string

  @IsEnum(DidDocumentRole)
  public role!: DidDocumentRole

  public static readonly type = 'DidRecord'
  public readonly type = DidRecord.type

  /**
   * The kms key ids associated with the DidRecord. Should only be used
   * when role is {@link DidDocumentRole.Created}.
   */
  keys?: DidDocumentKey[]

  public constructor(props: DidRecordProps) {
    super()

    if (props) {
      this.id = props.id ?? uuid()
      this.did = props.did
      this.role = props.role
      this.didDocument = props.didDocument
      this.createdAt = props.createdAt ?? new Date()
      this._tags = props.tags ?? {}
      this.keys = props.keys
    }
  }

  public getTags() {
    const did = parseDid(this.did)

    const legacyDid = this.metadata.get(DidRecordMetadataKeys.LegacyDid)

    return {
      ...this._tags,
      role: this.role,
      method: did.method,
      legacyUnqualifiedDid: legacyDid?.unqualifiedDid,
      did: this.did,
      methodSpecificIdentifier: did.id,

      // Calculate if we have a did document, otherwise use the already present recipient keys.
      // v1 compatibility: index both Ed25519 and X25519 fingerprints so v1 unpack
      // can find the DidRecord regardless of which curve the peer used as kid.
      // v2 does not use fingerprint-based lookup (resolves by DID URL instead).
      recipientKeyFingerprints: this.didDocument
        ? (() => {
            const prints = new Set<string>()
            const doc = this.didDocument!
            for (const recipientKey of doc.recipientKeys) {
              prints.add(recipientKey.fingerprint)
              if (recipientKey.is(Ed25519PublicJwk)) {
                prints.add(recipientKey.convertTo(X25519PublicJwk).fingerprint)
              }
              if (recipientKey.is(X25519PublicJwk)) {
                const paired = findMatchingEd25519Key(recipientKey as PublicJwk<X25519PublicJwk>, doc)
                if (paired) prints.add(paired.publicJwk.fingerprint)
              }
            }
            return [...prints]
          })()
        : this._tags.recipientKeyFingerprints,
    }
  }
}
