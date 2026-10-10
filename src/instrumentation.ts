export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { loadStudioModelEndpoints } = await import('@/lib/studio/model-endpoints')
  loadStudioModelEndpoints()
}
