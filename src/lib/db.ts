import { Pool } from 'pg';

// Create a singleton pool instance
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    // Strip quotes from password if they were added in .env.local
    let password = process.env.DATABASE_PASSWORD || '';
    if ((password.startsWith('"') && password.endsWith('"')) || 
        (password.startsWith("'") && password.endsWith("'"))) {
      password = password.slice(1, -1);
    }
    
    // Handle escaped dollar sign from .env.local
    password = password.replace(/\\\$/g, '$');

    // Validate required environment variables
    if (!process.env.DATABASE_HOST || !process.env.DATABASE_NAME || !process.env.DATABASE_USER || !password) {
      throw new Error('Missing required database environment variables. Check your .env.local file.');
    }

    pool = new Pool({
      host: process.env.DATABASE_HOST,
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: password,
      // Connection pool settings
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection cannot be established
    });

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });
  }

  return pool;
}

// Close the pool (useful for cleanup during development)
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
