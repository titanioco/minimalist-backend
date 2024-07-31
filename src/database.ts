import { createPool, Pool } from 'pg';

let pool: Pool;

export const setupDatabase = async () => {
  pool = createPool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: parseInt(process.env.DB_PORT || '5432'),
    max: 20,
  });

  // Test the connection
  try {
    const client = await pool.connect();
    console.log('Database connected successfully');
    client.release();
  } catch (err) {
    console.error('Database connection error', err);
  }
};

export const getPool = () => {
  if (!pool) {
    throw new Error('Database not initialized');
  }
  return pool;
};