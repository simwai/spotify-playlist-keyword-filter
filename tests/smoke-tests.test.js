jest.mock('sequelize')
jest.mock('uuid', () => ({
  v1: jest.fn(),
  v4: jest.fn(),
}))

describe('Smoke Tests – External Dependencies', () => {
  it('can reach Spotify API', async () => {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials&client_id=fake&client_secret=fake',
    })

    // We expect 400 (bad request) not network errors
    expect(response.status).toBe(400)
  }, 10000)

  it('can reach Genius API', async () => {
    const response = await fetch('https://api.genius.com/search?q=test')

    // We expect 401 (unauthorized) not network errors
    expect(response.status).toBe(401)
  }, 10000)
})
