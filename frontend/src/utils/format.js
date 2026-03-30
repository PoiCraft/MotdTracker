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
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

export function toTimeLabel(value, chartHours) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (chartHours > 24) {
    return date.toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}