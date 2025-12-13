// Quick test to verify environment variables are being read correctly
console.log('Environment Variables Check:');
console.log('DATABASE_HOST:', process.env.DATABASE_HOST);
console.log('DATABASE_PORT:', process.env.DATABASE_PORT);
console.log('DATABASE_NAME:', process.env.DATABASE_NAME);
console.log('DATABASE_USER:', process.env.DATABASE_USER);
console.log('DATABASE_PASSWORD length:', process.env.DATABASE_PASSWORD?.length);
console.log('DATABASE_PASSWORD first char:', process.env.DATABASE_PASSWORD?.[0]);
console.log('DATABASE_PASSWORD last char:', process.env.DATABASE_PASSWORD?.[process.env.DATABASE_PASSWORD.length - 1]);

// Test if there are any hidden characters
const password = process.env.DATABASE_PASSWORD || '';
console.log('Password bytes:', Buffer.from(password).toString('hex'));
