// If using CJS and `exports` key in package.json is not supported
// this ensures you can still import `@credo-ts/drizzle-storage/tenants`
exports.tenantsBundle = require('./build/tenants/bundle.js').tenantsBundle
