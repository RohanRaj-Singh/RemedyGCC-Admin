import 'server-only';

import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_DEVELOPMENT_MONGODB_URI = 'mongodb://127.0.0.1:27017/remedygcc';

interface RunMongoScriptOptions {
  label?: string;
}

interface MongoshScriptErrorPayload {
  name?: string;
  message?: string;
  code?: string | number | null;
  stack?: string | null;
  cause?: string | null;
}

interface MongoshParsedError {
  __error?: string | MongoshScriptErrorPayload;
}

function getMongoUri(): string {
  const configuredUri = process.env.MONGODB_URI?.trim();

  if (configuredUri) {
    return configuredUri;
  }

  if (process.env.NODE_ENV !== 'production') {
    return DEFAULT_DEVELOPMENT_MONGODB_URI;
  }

  throw new Error(
    'MONGODB_URI must be configured before starting the admin app in production.',
  );
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
      __error: {
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        code: error?.code ?? null,
        stack: error?.stack ?? null,
        cause: error?.cause?.message ?? (error?.cause ? String(error.cause) : null),
      },
    });
    quit(1);
  }
})();
`;
}

function maskMongoUri(uri: string): string {
  return uri.replace(
    /(mongodb(?:\+srv)?:\/\/[^:/?#]+:)([^@]+)(@)/i,
    '$1***$3',
  );
}

function toText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('utf8');
  }

  return value == null ? '' : String(value);
}

function getLastNonEmptyLine(output: string): string | null {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .pop() ?? null;
}

function parseMongoshPayload<T>(output: string): T | null {
  const lastLine = getLastNonEmptyLine(output);

  if (!lastLine) {
    return null;
  }

  try {
    return JSON.parse(lastLine) as T;
  } catch {
    return null;
  }
}

function formatMongoshScriptError(
  error: string | MongoshScriptErrorPayload | undefined,
): string {
  if (!error) {
    return 'Mongo shell request failed.';
  }

  if (typeof error === 'string') {
    return error;
  }

  const parts = [
    error.message,
    error.code ? `code=${error.code}` : null,
    error.cause ? `cause=${error.cause}` : null,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' | ') : 'Mongo shell request failed.';
}

export async function runMongoScript<T>(
  scriptBody: string,
  payload?: unknown,
  options: RunMongoScriptOptions = {},
): Promise<T> {
  const tempDir = await mkdtemp(join(tmpdir(), 'remedygcc-mongosh-'));
  const scriptPath = join(tempDir, 'script.js');
  const mongoshPath = getMongoshPath();
  const mongoUri = getMongoUri();
  const label = options.label ?? 'mongo-script';

  try {
  // Use a temp file instead of --eval so large branding payloads do not exceed
  // Windows command-line limits when tenants include uploaded data URLs.
  await writeFile(scriptPath, buildScript(scriptBody, payload ?? null), 'utf8');

  const { stdout, stderr } = await execFileAsync(
    mongoshPath,
    [
      mongoUri,
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

  if (stderr?.trim()) {
    console.error(`MONGOSH STDERR [${label}]:`, stderr);
  }

  const parsed = parseMongoshPayload<T | MongoshParsedError>(stdout);
  if (!parsed) {
    return null as T;
  }

  if (parsed && typeof parsed === 'object' && '__error' in parsed) {
    throw new Error(formatMongoshScriptError(parsed.__error));
  }

  return parsed as T;

} catch (error: unknown) {
  const stdout = error && typeof error === 'object' && 'stdout' in error
    ? toText(error.stdout)
    : '';
  const stderr = error && typeof error === 'object' && 'stderr' in error
    ? toText(error.stderr)
    : '';
  const parsedError = parseMongoshPayload<MongoshParsedError>(stdout);

  console.error(`MONGOSH EXEC ERROR [${label}]:`, error);
  console.error(`MONGOSH EXEC CONTEXT [${label}]:`, {
    mongoshPath,
    mongoUri: maskMongoUri(mongoUri),
    scriptPath,
    nodeEnv: process.env.NODE_ENV ?? 'development',
  });

  if (stdout) {
    console.error(`MONGOSH STDOUT [${label}]:`, stdout);
  }

  if (stderr) {
    console.error(`MONGOSH STDERR [${label}]:`, stderr);
  }

  if (parsedError?.__error) {
    console.error(`MONGOSH SCRIPT ERROR [${label}]:`, parsedError.__error);

    if (typeof parsedError.__error === 'object' && parsedError.__error?.stack) {
      console.error(`MONGOSH SCRIPT STACK [${label}]:`, parsedError.__error.stack);
    }

    throw new Error(formatMongoshScriptError(parsedError.__error));
  }

  throw error;
} finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
