import mongoose from 'mongoose';
export async function measureMongoLatency(): Promise<number> {
  try {
    if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      return -1;
    }
    const start = Date.now();
    await mongoose.connection.db.admin().ping();
    return Date.now() - start;
  } catch {
    return -1;
  }
}
export async function measureWebpanelLatency(
  webPort: number,
  timeoutMs = 3000
): Promise<{ latencyMs: number; online: boolean }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const response = await fetch(`http://localhost:${webPort}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;
    return { latencyMs, online: response.ok };
  } catch {
    clearTimeout(timeout);
    return { latencyMs: -1, online: false };
  }
}
