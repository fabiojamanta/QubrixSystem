const fs = require('fs');
const path = require('path');

const apiUrl = process.env.QUBRIX_API_URL || 'https://qubrix-api.onrender.com';
const target = path.join(__dirname, '..', 'src', 'environments', 'environment.prod.ts');
const content = `export const environment = {
  production: true,
  apiUrl: '${apiUrl}',
};
`;

fs.writeFileSync(target, content, 'utf8');
console.log(`API URL definida para: ${apiUrl}`);
