// Start-up work lives in instrumentation-node.ts and loads only on the Node runtime: the Edge build must not bundle the database driver (it needs Node's network and file modules).
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const m = await import('./instrumentation-node')
    await m.registerNode()
  }
}
