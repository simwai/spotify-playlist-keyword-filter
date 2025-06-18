const {
  SpotifyAuthService,
} = require('../backend/services/spotify-auth-service.js')

const mockConfig = {
  app: { isProduction: false, frontendUrl: 'http://localhost:3000' },
  spotify: { redirectUri: 'http://localhost:8888/callback' },
}

describe('SpotifyAuthService – OAuth workflow', () => {
  const mockHttp = { post: jest.fn(), get: jest.fn() }
  const mockLogger = { log: jest.fn(), error: jest.fn() }
  let service

  beforeEach(() => {
    service = new SpotifyAuthService(mockLogger, mockConfig, mockHttp)
    jest.clearAllMocks()
  })

  it('throws when dependencies missing', () => {
    expect(() => new SpotifyAuthService(null, mockConfig, mockHttp)).toThrow(
      'No logger provided'
    )
  })

  it('generates auth URL with state cookie', async () => {
    const mockRes = { cookie: jest.fn() }
    const clientId = 'test_client_id'
    const clientSecret = 'test_client_secret'

    const authUrl = await service.getAuthUrl(mockRes, clientId, clientSecret)

    expect(authUrl).toMatch(/^https:\/\/accounts\.spotify\.com\/authorize/)
    expect(authUrl).toContain('response_type=code')
    expect(authUrl).toContain('state=')
    expect(mockRes.cookie).toHaveBeenCalledWith(
      'spotify_auth_state',
      expect.any(String),
      expect.objectContaining({ httpOnly: true })
    )
  })

  it('handles successful OAuth callback', async () => {
    // Mock Spotify responses
    mockHttp.post.mockResolvedValue({
      statusCode: 200,
      body: { access_token: 'AT123', refresh_token: 'RT123' },
    })
    mockHttp.get.mockResolvedValue({
      body: { id: 'user123' },
    })

    const mockReq = {
      query: { code: 'auth_code', state: 'test_state' },
      cookies: {
        spotify_auth_state: 'test_state',
        spotify_client_id: 'test_client_id',
        spotify_client_secret: 'test_client_secret',
      },
    }
    const mockRes = { clearCookie: jest.fn() }

    const redirectUrl = await service.handleCallback(mockReq, mockRes)

    expect(redirectUrl).toContain('access_token=AT123')
    expect(redirectUrl).toContain('refresh_token=RT123')
    expect(redirectUrl).toContain('uid=user123')
    expect(mockRes.clearCookie).toHaveBeenCalled()
  })

  it('rejects callback with invalid state', async () => {
    const mockReq = {
      query: { code: 'auth_code', state: 'wrong_state' },
      cookies: {
        spotify_auth_state: 'correct_state',
        spotify_client_id: 'test_client_id',
        spotify_client_secret: 'test_client_secret',
      },
    }
    const mockRes = { clearCookie: jest.fn() }

    await expect(service.handleCallback(mockReq, mockRes)).rejects.toThrow(
      'Security validation failed'
    )
  })
})
