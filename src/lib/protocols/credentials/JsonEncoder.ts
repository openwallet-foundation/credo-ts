export class JsonEncoder {
  // TODO I would rather see here use of `object` instead of `unknown` but that's banned by @typescript-eslint/ban-types.
  // Type `Record<string, unknown>` returns weird error "Index signature is missing in type 'Cred'.".
  public static encode(data: unknown) {
    return Buffer.from(JSON.stringify(data), 'utf-8').toString('base64');
  }

  public static decode(base64: string) {
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf-8'));
  }
}
