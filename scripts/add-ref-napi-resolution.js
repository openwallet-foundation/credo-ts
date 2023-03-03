const fs = require('fs')
const path = require('path')

// Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json')
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath))

// Add ref-napi resolution
packageJson.resolutions = {
  ...packageJson.resolutions,
  'ref-napi': 'npm:@2060.io/ref-napi',
}

// Write package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2))
