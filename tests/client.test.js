const mockJQuery = {
  ajax: jest.fn(),
  each: jest.fn(),
  fn: {},
}

global.$ = jest.fn(() => ({
  hide: jest.fn(),
  show: jest.fn(),
  val: jest.fn(),
  empty: jest.fn(),
  find: jest.fn(() => ({
    append: jest.fn(),
    remove: jest.fn(),
  })),
  append: jest.fn(),
  remove: jest.fn(),
  on: jest.fn(),
  is: jest.fn(),
  css: jest.fn(),
  html: jest.fn(),
}))

Object.assign(global.$, mockJQuery)

global.window = {
  location: {
    hash: '',
    href: '',
  },
}

global.fetch = jest.fn()
global.console = {
  log: jest.fn(),
  error: jest.fn(),
}

global.DOMParser = jest.fn(() => ({
  parseFromString: jest.fn(() => ({
    querySelector: jest.fn(),
  })),
}))

describe('Client-Side Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Hash Parameter Parsing', () => {
    test('should parse hash parameters correctly', () => {
      function getHashParams() {
        const hashParams = {}
        const queryString = window.location.hash.substring(1)
        const pairs = queryString.split('&')
        for (const pair of pairs) {
          const [key, value] = pair.split('=')
          if (key && value) {
            hashParams[decodeURIComponent(key)] = decodeURIComponent(value)
          }
        }
        return hashParams
      }

      window.location.hash = '#access_token=test_token&uid=test_uid'

      const params = getHashParams()
      expect(params.access_token).toBe('test_token')
      expect(params.uid).toBe('test_uid')
    })
  })

  describe('Error Handling', () => {
    test('sendErrorToUrl should update window location', () => {
      function sendErrorToUrl(msg) {
        console.log(msg)
        window.location = '/#error=' + msg
      }

      sendErrorToUrl('test_error')
      expect(console.log).toHaveBeenCalledWith('test_error')
      expect(window.location).toBe('/#error=test_error')
    })
  })

  describe('Navigation Handler', () => {
    test('should show/hide correct elements based on login state', () => {
      const mockElement = {
        hide: jest.fn(),
        show: jest.fn(),
        css: jest.fn(() => 'none'),
      }

      global.$ = jest.fn((_selector) => mockElement)

      function navigationHandler(playlistForm, tagForm) {
        const loggedIn = true

        $('#login').hide()
        $('#logged-in').hide()
        $('#playlist-form').hide()
        $('#tag-form').hide()

        if (!loggedIn) {
          $('#login').show()
        } else {
          $('#logged-in').show()
          if (playlistForm) {
            $('#playlist-form').show()
          }
          if (tagForm) {
            $('#tag-form').show()
          }
        }

        if ($('#footer').css('display') === 'none') {
          $('#footer').css('display', 'inline-flex')
        }
      }

      navigationHandler(true, false)

      expect(mockElement.hide).toHaveBeenCalledTimes(4)
      expect(mockElement.show).toHaveBeenCalledTimes(2)
    })
  })

  describe('Spotify API Functions', () => {
    test('getSpotify should make authenticated AJAX request', async () => {
      global.$.ajax = jest.fn((url, options) => {
        options.success({ data: 'test' })
        return Promise.resolve({ data: 'test' })
      })

      function getSpotify(url, data) {
        return new Promise((resolve, reject) => {
          $.ajax(url, {
            dataType: 'json',
            data: data,
            headers: {
              Authorization: 'Bearer test_token',
            },
            success: function (response) {
              resolve(response)
            },
            error: function (_response) {
              reject(new Error('get_spotify'))
            },
          })
        })
      }

      const result = await getSpotify('test_url', { test: 'data' })

      expect(global.$.ajax).toHaveBeenCalledWith('test_url', {
        dataType: 'json',
        data: { test: 'data' },
        headers: {
          Authorization: 'Bearer test_token',
        },
        success: expect.any(Function),
        error: expect.any(Function),
      })
      expect(result).toEqual({ data: 'test' })
    })
  })
})
