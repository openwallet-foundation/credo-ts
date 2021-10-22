export type MetadataBase = {
  [key: string]: Record<string, unknown>
}

export class Metadata {
  public readonly data: MetadataBase

  public constructor(data: MetadataBase) {
    this.data = data
  }

  public get<T extends Record<string, unknown>>(key: string): T | null {
    return (this.data[key] as T) ?? null
  }

  public set(key: string, value: Record<string, unknown>): void {
    this.data[key] = value
  }

  public getAll(): MetadataBase {
    return this.data
  }

  public delete(key: string): void {
    delete this.data[key]
  }
}
