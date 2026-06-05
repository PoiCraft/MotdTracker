import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "--"
  return new Date(dateStr).toLocaleString()
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "--"
  return new Date(dateStr).toLocaleDateString()
}
