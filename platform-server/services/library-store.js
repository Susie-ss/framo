// Durable storage for parsed Sketch libraries.
//
// Render's free filesystem is ephemeral, so production uses PostgreSQL when
// DATABASE_URL is configured. Local development retains the JSON/filesystem
// implementation as a compatible fallback.
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL);
}

function createStore(options) {
  const dataFile = options.dataFile;
  const deletedFile = options.deletedFile;
  const assetRoot = options.assetRoot;
  const pgEnabled = hasDatabaseUrl();
  let pool = null;
  let schemaPromise = null;

  function getPool() {
    if (!pgEnabled) return null;
    if (!pool) {
      const { Pool } = require('pg');
      pool = new Pool({
        connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
        ssl: { rejectUnauthorized: false },
        max: 4,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      });
    }
    return pool;
  }

  async function ensureSchema() {
    if (!pgEnabled) return;
    if (!schemaPromise) {
      schemaPromise = (async () => {
        const client = getPool();
        await client.query(`CREATE TABLE IF NOT EXISTS framo_sketch_libraries (
          id TEXT PRIMARY KEY,
          library_json JSONB NOT NULL,
          updated_at BIGINT NOT NULL
        )`);
        await client.query(`CREATE TABLE IF NOT EXISTS framo_deleted_libraries (
          id TEXT PRIMARY KEY,
          deleted_at BIGINT NOT NULL
        )`);
        await client.query(`CREATE TABLE IF NOT EXISTS framo_library_assets (
          library_id TEXT NOT NULL,
          file_name TEXT NOT NULL,
          content BYTEA NOT NULL,
          updated_at BIGINT NOT NULL,
          PRIMARY KEY (library_id, file_name)
        )`);
      })();
    }
    return schemaPromise;
  }

  async function readLocal(file, fallback) {
    try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return fallback; }
  }

  async function loadSketchLibraries() {
    if (!pgEnabled) return readLocal(dataFile, []);
    await ensureSchema();
    const result = await getPool().query('SELECT library_json FROM framo_sketch_libraries ORDER BY updated_at DESC');
    return result.rows.map((row) => row.library_json);
  }

  async function loadDeletedLibraryIds() {
    if (!pgEnabled) return readLocal(deletedFile, []);
    await ensureSchema();
    const result = await getPool().query('SELECT id FROM framo_deleted_libraries');
    return result.rows.map((row) => row.id);
  }

  async function saveAssets(libraryId) {
    if (!pgEnabled) return;
    const directory = path.join(assetRoot, libraryId);
    const client = getPool();
    await client.query('DELETE FROM framo_library_assets WHERE library_id = $1', [libraryId]);
    if (!fs.existsSync(directory)) return;
    const names = (await fsp.readdir(directory)).filter((name) => name.toLowerCase().endsWith('.svg'));
    for (const name of names) {
      const content = await fsp.readFile(path.join(directory, name));
      await client.query(
        'INSERT INTO framo_library_assets (library_id, file_name, content, updated_at) VALUES ($1, $2, $3, $4)',
        [libraryId, name, content, Date.now()]
      );
    }
  }

  async function saveSketchLibraries(libraries) {
    const sketchLibraries = libraries.filter((item) => item.sourceType === 'sketch');
    if (!pgEnabled) {
      await fsp.mkdir(path.dirname(dataFile), { recursive: true });
      await fsp.writeFile(dataFile, JSON.stringify(sketchLibraries, null, 2));
      return;
    }
    await ensureSchema();
    const client = getPool();
    const ids = sketchLibraries.map((library) => library.id);
    if (ids.length) await client.query('DELETE FROM framo_sketch_libraries WHERE NOT (id = ANY($1::text[]))', [ids]);
    else await client.query('DELETE FROM framo_sketch_libraries');
    for (const library of sketchLibraries) {
      await client.query(
        `INSERT INTO framo_sketch_libraries (id, library_json, updated_at)
         VALUES ($1, $2::jsonb, $3)
         ON CONFLICT (id) DO UPDATE SET library_json = EXCLUDED.library_json, updated_at = EXCLUDED.updated_at`,
        [library.id, JSON.stringify(library), Date.now()]
      );
      await saveAssets(library.id);
    }
  }

  async function saveDeletedLibraryIds(ids) {
    if (!pgEnabled) {
      await fsp.mkdir(path.dirname(deletedFile), { recursive: true });
      await fsp.writeFile(deletedFile, JSON.stringify([...ids], null, 2));
      return;
    }
    await ensureSchema();
    const client = getPool();
    await client.query('DELETE FROM framo_deleted_libraries');
    for (const id of ids) {
      await client.query('INSERT INTO framo_deleted_libraries (id, deleted_at) VALUES ($1, $2)', [id, Date.now()]);
    }
  }

  async function deleteAssets(libraryId) {
    if (pgEnabled) {
      await ensureSchema();
      await getPool().query('DELETE FROM framo_library_assets WHERE library_id = $1', [libraryId]);
    }
    await fsp.rm(path.join(assetRoot, libraryId), { recursive: true, force: true });
  }

  async function getAsset(libraryId, fileName) {
    if (!pgEnabled) {
      try { return await fsp.readFile(path.join(assetRoot, libraryId, fileName)); } catch { return null; }
    }
    await ensureSchema();
    const result = await getPool().query(
      'SELECT content FROM framo_library_assets WHERE library_id = $1 AND file_name = $2', [libraryId, fileName]
    );
    return result.rows[0] ? result.rows[0].content : null;
  }

  return { isDatabase: pgEnabled, loadSketchLibraries, loadDeletedLibraryIds, saveSketchLibraries, saveDeletedLibraryIds, deleteAssets, getAsset };
}

module.exports = { createStore };
