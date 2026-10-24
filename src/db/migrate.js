import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './pool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// All schema phases, in order. Add new phases to this list ONLY —
// no other wiring required.
const PHASES = [
  'schema.sql',
  'schema_phase2.sql',
  'schema_phase3.sql',
  'schema_phase4.sql',
  'schema_phase5.sql',
  'schema_phase6.sql',
  'schema_phase7.sql',
  'schema_phase8.sql',
  'schema_phase9.sql',
  'schema_phase10.sql',
  'schema_phase11.sql',
];

// Some managed Postgres plans (e.g. Render free tier) don't include PostGIS.
// Map features need it, but for a demo the rest of the app should still deploy.
// We probe for PostGIS; if absent, GEOGRAPHY columns degrade to TEXT so every
// other table and feature works. Re-run on a PostGIS-enabled DB to restore maps.
async function postgisAvailable() {
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM pg_available_extensions WHERE name = 'postgis' LIMIT 1`
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function migrate() {
  try {
    const hasPostgis = await postgisAvailable();
    if (!hasPostgis) {
      console.log('  NOTE: PostGIS not available — map/location columns will use TEXT. All other features work.');
    }
    for (const file of PHASES) {
      let sql = readFileSync(join(__dirname, file), 'utf8');
      if (!hasPostgis) {
        sql = sql
          .replace(/CREATE EXTENSION IF NOT EXISTS postgis;/gi, '-- PostGIS skipped (not available)')
          .replace(/GEOGRAPHY\s*\(\s*POINT\s*,\s*4326\s*\)/gi, 'TEXT');
      }
      await pool.query(sql);
      console.log(`  applied ${file}`);
    }
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
