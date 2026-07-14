import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

/**
 * Miroir assets : dossier local ↔ bucket GCS (préfixe).
 * GCS_ASSETS_URI format : gs://bucket/prefix  ou  bucket/prefix
 * Auth : Application Default Credentials (VM SA / GOOGLE_APPLICATION_CREDENTIALS).
 */
export async function syncAssets({ localDir, gcsUri }) {
  if (!localDir || !gcsUri) {
    return { skipped: true, reason: 'LOCAL_ASSETS_DIR ou GCS_ASSETS_URI non défini' };
  }

  await fs.mkdir(localDir, { recursive: true });

  let Storage;
  try {
    ({ Storage } = await import('@google-cloud/storage'));
  } catch {
    return { skipped: true, reason: '@google-cloud/storage non installé' };
  }

  const { bucketName, prefix } = parseGcsUri(gcsUri);
  const storage = new Storage();
  const bucket = storage.bucket(bucketName);

  let downloaded = 0;
  let uploaded = 0;

  // Pull : GCS → local (écrase si remote plus récent ou local absent)
  const [remoteFiles] = await bucket.getFiles({ prefix });
  for (const file of remoteFiles) {
    if (file.name.endsWith('/')) continue;
    const rel = file.name.slice(prefix.length).replace(/^\//, '');
    if (!rel) continue;
    const dest = path.join(localDir, rel);
    await fs.mkdir(path.dirname(dest), { recursive: true });

    const [meta] = await file.getMetadata();
    const remoteUpdated = new Date(meta.updated || meta.timeCreated || 0).getTime();
    let localUpdated = 0;
    try {
      const st = await fs.stat(dest);
      localUpdated = st.mtimeMs;
    } catch {
      /* absent */
    }
    if (!localUpdated || remoteUpdated > localUpdated) {
      await pipeline(file.createReadStream(), createWriteStream(dest));
      downloaded += 1;
    }
  }

  // Push : local → GCS
  const localFiles = await walkFiles(localDir);
  for (const abs of localFiles) {
    const rel = path.relative(localDir, abs).split(path.sep).join('/');
    const objectName = prefix ? `${prefix.replace(/\/$/, '')}/${rel}` : rel;
    const remote = bucket.file(objectName);
    const st = await fs.stat(abs);
    let remoteUpdated = 0;
    try {
      const [meta] = await remote.getMetadata();
      remoteUpdated = new Date(meta.updated || 0).getTime();
    } catch {
      /* absent */
    }
    if (!remoteUpdated || st.mtimeMs > remoteUpdated) {
      await pipeline(createReadStream(abs), remote.createWriteStream());
      uploaded += 1;
    }
  }

  return { ok: true, bucket: bucketName, prefix, downloaded, uploaded };
}

function parseGcsUri(uri) {
  const cleaned = uri.replace(/^gs:\/\//, '');
  const slash = cleaned.indexOf('/');
  if (slash < 0) return { bucketName: cleaned, prefix: '' };
  return {
    bucketName: cleaned.slice(0, slash),
    prefix: cleaned.slice(slash + 1),
  };
}

async function walkFiles(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walkFiles(full)));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

export function resolveDefaultAssetsDir() {
  return process.env.LOCAL_ASSETS_DIR || path.join(process.cwd(), 'data', 'assets');
}
