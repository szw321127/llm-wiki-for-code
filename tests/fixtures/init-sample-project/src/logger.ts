export function logInfo(message: string, extra = {}) {
  console.info({ level: "info", message, extra });
}
