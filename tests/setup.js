/* Global Jest setup – runs before every test */

jest.spyOn(console, 'log').mockImplementation(() => {})
jest.spyOn(console, 'warn').mockImplementation(() => {})
jest.spyOn(console, 'error').mockImplementation(() => {})

/* handy helpers */
global.collectAsyncGenerator = async (gen) => {
  const out = []
  for await (const v of gen) {
    out.push(v)
  }
  return out
}
