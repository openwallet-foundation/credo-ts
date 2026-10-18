---
'@credo-ts/core': minor
'@credo-ts/didcomm': minor
'@credo-ts/anoncreds': minor
'@credo-ts/openid4vc': minor
'@credo-ts/tenants': minor
'@credo-ts/action-menu': minor
'@credo-ts/question-answer': minor
'@credo-ts/drpc': minor
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

Records that fail to decode now throw a `ZodValidationError` instead of a `ClassValidationError`.
