const { fetchLyrics, fetchSongId } = require('./index.js')
 
describe("fetchLyrics", () => {
  // Run something one time on start
  beforeAll(() => {
    jest.mock(fetchSongId, () => jest.fn().mockResolvedValue("123"));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should return lyrics when successful", async () => {
    // Mocking necessary dependencies and response data
    const mockFetch = jest.fn().mockResolvedValueOnce({
      text: jest
        .fn()
        .mockResolvedValueOnce('<div class="lyrics">Some lyrics</div>'),
    });
    global.fetch = mockFetch;
    fetchSongId.mockResolvedValueOnce("123");

    // Calling the function
    const lyrics = await fetchLyrics("Artist", "Song");

    // Assertions
    expect(lyrics).toBe("Some lyrics");
    expect(fetchSongId).toHaveBeenCalledWith("Artist", "Song");
    expect(mockFetch).toHaveBeenCalledWith(
      "/proxy/http://genius.com/songs/123",
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
          "cache-control": "max-age=0",
          connection: "keep-alive",
          host: "genius.com",
        },
      }
    );
  });

  test("should handle error and return null", async () => {
    // Mocking necessary dependencies and response data
    const mockFetch = jest.fn().mockRejectedValueOnce(new Error("Some error"));
    global.fetch = mockFetch;
    fetchSongId.mockResolvedValueOnce("123");

    // Calling the function
    const lyrics = await fetchLyrics("Artist", "Song");

    // Assertions
    expect(lyrics).toBeNull();
    expect(fetchSongId).toHaveBeenCalledWith("Artist", "Song");
    expect(mockFetch).toHaveBeenCalledWith(
      "/proxy/http://genius.com/songs/123",
      {
        headers: {
          accept: "*/*",
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7",
          "cache-control": "max-age=0",
          connection: "keep-alive",
          host: "genius.com",
        },
      }
    );
    expect(console.log).toHaveBeenCalledWith(new Error("Some error"));
  });
});
