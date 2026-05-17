import 'server-only';

import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_DEVELOPMENT_MONGODB_URI = 'mongodb://127.0.0.1:27017/remedygcc';

function getMongoUri(): string {
  const configuredUri = process.env.MONGODB_URI?.trim();

  if (configuredUri) {
    return configuredUri;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_DEVELOPMENT_MONGODB_URI;
  }

  throw new Error('MONGODB_URI must be configured before starting the admin app in production.');
}

function getMongoshPath(): string {
  const configuredPath = process.env.MONGOSH_PATH?.trim();

  if (configuredPath) {
    return configuredPath;
  }

  return process.platform === 'win32' ? 'C:\\mongosh\\bin\\mongosh.exe' : 'mongosh';
}

function buildScript(scriptBody: string, payload: unknown): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload ?? null), 'utf8').toString('base64url');

  return `
const __payload = JSON.parse(Buffer.from(${JSON.stringify(encodedPayload)}, 'base64url').toString('utf8'));
const __emit = (value) => print(JSON.stringify(value));
const __strip = (value) => {
  if (Array.isArray(value)) {
    return value.map(__strip);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const next = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (key === '_id') {
      continue;
    }

    next[key] = __strip(entryValue);
  }

  return next;
};

(async () => {
  try {
    ${scriptBody}
  } catch (error) {
    __emit({
      __error: error?.message ?? String(error),
    });
    quit(1);
  }
})();
`;
}

export async function runMongoScript<T>(
  scriptBody: string,
  payload?: unknown,
): Promise<T> {
  const tempDir = await mkdtemp(join(tmpdir(), 'remedygcc-mongosh-'));
  const scriptPath = join(tempDir, 'script.js');

  try {
    // Use a temp file instead of --eval so large branding payloads do not exceed
    // Windows command-line limits when tenants include uploaded data URLs.
    await writeFile(scriptPath, buildScript(scriptBody, payload ?? null), 'utf8');

    const { stdout } = await execFileAsync(
      getMongoshPath(),
      [
        getMongoUri(),
        '--quiet',
        '--file',
        scriptPath,
      ],
      {
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
        env: {
          ...process.env,
          MONGOSH_DISABLE_TELEMETRY: '1',
        },
      },
    );

    const lastLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .pop();

    if (!lastLine) {
      return null as T;
    }

    const parsed = JSON.parse(lastLine) as T | { __error?: string };
    if (parsed && typeof parsed === 'object' && '__error' in parsed) {
      throw new Error(parsed.__error || 'Mongo shell request failed.');
    }

    return parsed as T;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
