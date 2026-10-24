import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Two ways to configure the database:
//  1. DATABASE_URL — a single connection string (Render, Railway, Heroku, etc.)
//  2. DB_HOST / DB_USER / ... — individual vars (local dev, ECS task secrets)
// If DATABASE_URL is present it wins.
const useUrl = !!process.env.DATABASE_URL;

const pool = new pg.Pool(
  useUrl
    ? {
        connectionString: process.env.DATABASE_URL,
        // Managed hosts require SSL. Set DB_SSL=false only for a local URL.
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        // RDS requires SSL in production. Disable locally with DB_SSL=false.
        ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected idle client error', err);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
