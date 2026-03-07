const http = require('http');

/**
 * 🏥 STAFF-LEVEL HEALTH PROBE
 * Performs a deep architecture check including DB and Worker status.
 */
const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/health?deep=true',
  method: 'GET',
  timeout: 5000,
};

const request = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const payload = JSON.parse(data);
      if (res.statusCode === 200 && payload.data?.status === 'healthy') {
        process.exit(0);
      }
      console.error('🏥 Health Probe Failed:', payload.data?.status || 'Unknown');
      process.exit(1);
    } catch {
      console.error('🏥 Health Probe Parse Error');
      process.exit(1);
    }
  });
});

request.on('error', (err) => {
  console.error('🏥 Health Probe Connection Error:', err.message);
  process.exit(1);
});

request.end();
