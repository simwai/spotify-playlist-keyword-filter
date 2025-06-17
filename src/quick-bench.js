const http = require('http')
const payload = JSON.stringify({
  tracks: Array.from({ length: 100 }, (_, i) => ({
    id: 'id' + i,
    uri: 'spotify:track:id' + i,
    name: 'Song ' + i,
    artists: [{ name: 'Artist' }],
  })),
})

const options = {
  hostname: 'localhost',
  port: 8888,
  path: '/api/lyrics/bulk-process',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  },
}

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`)
  let data = ''
  res.on('data', (chunk) => {
    data += chunk
  })
  res.on('end', () => {
    console.log('Response completed')
    try {
      const parsed = JSON.parse(data)
      console.log(`Processed: ${parsed.processed}, Results: ${parsed.results}`)
    } catch (e) {
      console.log('Could not parse response')
    }
  })
})

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`)
})

req.write(payload)
req.end()
