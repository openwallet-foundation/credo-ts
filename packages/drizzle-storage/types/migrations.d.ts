// This file helps with type-hinting for drizzle-generated migrations.js files
// used to apply migrations in React Native

declare const _default: {
  journal: {
    entries: {
      idx: number
      when: number
      tag: string
      breakpoints: boolean
    }[]
  }
  migrations: Record<string, string>
}
export default _default
