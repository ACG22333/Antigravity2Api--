const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  if (fs.existsSync(dirPath)) return;
  try {
    fs.mkdirSync(dirPath, { recursive: true });
  } catch (err) {
    console.error("Failed to create log directory:", err);
  }
}

function normalizeRetentionDays(value, fallbackDays) {
  if (value === undefined || value === null || value === "") return fallbackDays;
  const n = Number.parseInt(String(value).trim(), 10);
  if (!Number.isFinite(n) || n < 0) return fallbackDays;
  return n;
}

async function cleanupOldLogs(logDir, retentionDays) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return { deleted: 0, scanned: 0 };

  const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let entries = [];
  try {
    entries = await fs.promises.readdir(logDir, { withFileTypes: true });
  } catch {
    return { deleted: 0, scanned: 0 };
  }

  let scanned = 0;
  let deleted = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".log")) continue;
    scanned++;

    const filePath = path.join(logDir, entry.name);
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.mtimeMs >= cutoffMs) continue;
      await fs.promises.unlink(filePath);
      deleted++;
    } catch {
      // ignore (locked file / permission / race)
    }
  }

  return { deleted, scanned };
}

function formatLogContent(data) {
  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return data;
    }
  }
  if (data !== undefined && data !== null) {
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  }
  return "";
}

function createLogger(options = {}) {
  const logDir = options.logDir || path.resolve(process.cwd(), "log");
  ensureDir(logDir);

  const retentionDays = normalizeRetentionDays(
    options.retentionDays ?? options.logRetentionDays ?? options.retention_days,
    3
  );

  const now = new Date();
  const logFileName = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(
    2,
    "0"
  )}-${String(now.getSeconds()).padStart(2, "0")}.log`;

  const logFile = path.join(logDir, logFileName);

  console.log(`[info] 📝 Logging requests to: ${logFile}`);

  // Best-effort retention cleanup (default: keep 3 days). 0 disables cleanup.
  if (retentionDays > 0) {
    cleanupOldLogs(logDir, retentionDays)
      .then(({ deleted }) => {
        if (deleted > 0) console.log(`[info] 🧹 Deleted ${deleted} old log file(s) (keep ${retentionDays}d)`);
      })
      .catch(() => {});

    const intervalMs = options.cleanupIntervalMs ?? 12 * 60 * 60 * 1000;
    const timer = setInterval(() => {
      cleanupOldLogs(logDir, retentionDays).catch(() => {});
    }, intervalMs);
    if (typeof timer.unref === "function") timer.unref();
  }

  const log = (title, data) => {
    const timestamp = new Date().toISOString();
    const separator = "-".repeat(50);
    const contentStr = formatLogContent(data);
    const logEntry = `[${timestamp}] ${title}\n${contentStr}\n${separator}\n`;

    console.log(`\n[${timestamp}] ${title}`);
    if (data !== undefined && data !== null) {
      console.log(contentStr);
    }

    fs.appendFile(logFile, logEntry, (err) => {
      if (err) console.error("Failed to write to log file:", err);
    });
  };

  return { log, logFile };
}

module.exports = {
  createLogger,
};
