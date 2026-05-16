export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined) {
    return "未知";
  }
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatTime(value) {
  if (!value) {
    return "未知";
  }
  return new Date(value.replace(" ", "T")).toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" });
}

export function toTimeLabel(value, chartHours) {
  if (!value) {
    return "-";
  }
  const date = new Date(value.replace(" ", "T"));
  if (chartHours > 24) {
    return date.toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Shanghai"
    });
  }
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Shanghai" });
}

export function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(Number(bytes))) {
    return "—";
  }
  const value = Number(bytes);
  if (value < 1024) return `${value.toFixed(0)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let n = value / 1024;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  let digits = 2;
  if (n >= 100) {
    digits = 0;
  } else if (n >= 10) {
    digits = 1;
  }
  return `${n.toFixed(digits)} ${units[i]}`;
}

export function formatUptime(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) {
    return "—";
  }
  const safe = Math.max(0, Math.floor(Number(seconds)));
  const days = Math.floor(safe / 86400);
  const hours = Math.floor((safe % 86400) / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
