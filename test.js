const http = require('http');
http.get('http://localhost:8081/admin/users', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log('Status:', res.statusCode));
});
