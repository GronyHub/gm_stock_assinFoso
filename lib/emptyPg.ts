// Stands in for the 'pg' package in browser bundles. Some browser code imports a file that also imports lib/db.ts; the database driver is never used in the browser
// (lib/db.ts only connects on the server), so this empty stand-in keeps pg and its Node-only parts out of the browser build.
export class Pool {
  constructor() { throw new Error('The database driver is only available on the server.') }
}
export default { Pool }
