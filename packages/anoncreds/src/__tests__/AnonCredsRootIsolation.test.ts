import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

test('the AnonCreds root runtime and type graph does not reach DIDComm', () => {
  const pending = [path.resolve(__dirname, '../index.ts')]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const file = pending.pop()
    if (!file || visited.has(file)) continue
    visited.add(file)
    const source = readFileSync(file, 'utf8')
    for (const { fileName: specifier } of ts.preProcessFile(source, true, true).importedFiles) {
      expect(specifier, `DIDComm dependency reachable through ${file}`).not.toMatch(/^@credo-ts\/didcomm(?:\/|$)/)
      if (!specifier.startsWith('.')) continue
      const base = path.resolve(path.dirname(file), specifier)
      const target = [`${base}.ts`, path.join(base, 'index.ts')].find((candidate) => existsSync(candidate))
      expect(target, `Unresolved relative dependency ${specifier} in ${file}`).toBeDefined()
      if (target) pending.push(target)
    }
  }
})
