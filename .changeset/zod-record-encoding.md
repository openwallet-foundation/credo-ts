---
'@credo-ts/core': patch
'@credo-ts/didcomm': patch
'@credo-ts/anoncreds': patch
'@credo-ts/openid4vc': patch
'@credo-ts/tenants': patch
'@credo-ts/action-menu': patch
'@credo-ts/question-answer': patch
'@credo-ts/drpc': patch
'@credo-ts/drizzle-storage': patch
---

All records in Credo are now encoded, decoded and validated with a zod schema instead of class-transformer and class-validator. This is the first step of moving Credo away from class-transformer and class-validator. The stored format of records doesn't change, so no storage migration is needed.

A class opts in by defining a static `encodingSchema` (a zod codec). `JsonTransformer` and `MessageValidator` use it when present, and fall back to class-transformer and class-validator otherwise, so custom records and other classes keep working without changes. Records can define their schema with `createRecordEncodingSchema`:

```ts
import { BaseRecord, createRecordEncodingSchema, zIsoDate } from '@credo-ts/core'
import { z } from 'zod'

const myRecordEncodingSchema = createRecordEncodingSchema({
  name: z.string(),
  expiresAt: zIsoDate.optional(),
})

export class MyRecord extends BaseRecord {
  public static get encodingSchema() {
    return myRecordEncodingSchema
  }

  // ...
}
```

Two things behave differently:

- Records that fail to decode now throw a `ZodValidationError` instead of a `ClassValidationError`. Both extend `CredoError`.
- A subclass of a Credo record inherits the record's `encodingSchema`. Properties the subclass adds with class-transformer decorators are still stored, but no longer transformed (for example a `Date` is decoded as a string). Define an `encodingSchema` on the subclass to transform them.
