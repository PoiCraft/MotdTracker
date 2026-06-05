import { useMemo, useId } from "react"
import { cn } from "@/lib/utils"

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  alertColor?: string
  alertThreshold?: number
  className?: string
  fill?: boolean
}

function buildSmoothPath(points: [number, number][]): string {
  if (points.length === 0) return ""
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`

  let d = `M ${points[0][0]} ${points[0][1]}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(points.length - 1, i + 2)]

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2[0]} ${p2[1]}`
  }

  return d
}

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "hsl(160 84% 39%)",
  alertColor = "hsl(0 84% 60%)",
  alertThreshold,
  className,
  fill = true,
}: SparklineProps) {
  const reactId = useId()
  const { path, fillPath, isAlert, gradientId } = useMemo(() => {
    const id = `spark-${reactId.replace(/:/g, "")}`
    const padding = 2
    const w = width - padding * 2
    const h = height - padding * 2

    if (data.length === 0) {
      return { path: "", fillPath: "", isAlert: false, gradientId: id }
    }

    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    const points: [number, number][] = data.map((v, i) => [
      padding + (i / (data.length - 1)) * w,
      padding + h - ((v - min) / range) * h,
    ])

    const smoothPath = buildSmoothPath(points)

    const lastVal = data[data.length - 1]
    const alert = alertThreshold != null && lastVal > alertThreshold

    const areaPath = smoothPath
      ? `${smoothPath} L ${points[points.length - 1][0]} ${height} L ${points[0][0]} ${height} Z`
      : ""

    return {
      path: smoothPath,
      fillPath: areaPath,
      isAlert: alert,
      gradientId: id,
    }
  }, [data, width, height, alertThreshold, reactId])

  if (data.length < 2) {
    return (
      <svg width={width} height={height} className={cn("shrink-0", className)}>
        <line
          x1={2}
          y1={height / 2}
          x2={width - 2}
          y2={height / 2}
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-muted-foreground/30"
          strokeDasharray="4 3"
        />
      </svg>
    )
  }

  const strokeColor = isAlert ? alertColor : color
  const fillOpacity = isAlert ? 0.12 : 0.08

  return (
    <svg
      width={width}
      height={height}
      className={cn("shrink-0", className)}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && fillPath && (
        <path d={fillPath} fill={`url(#${gradientId})`} />
      )}
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {isAlert && data.length > 0 && (
        <circle
          cx={width - 2}
          cy={
            (() => {
              const min = Math.min(...data)
              const max = Math.max(...data)
              const range = max - min || 1
              const padding = 2
              const h = height - padding * 2
              return padding + h - ((data[data.length - 1] - min) / range) * h
            })()
          }
          r={2.5}
          fill={alertColor}
          className="animate-pulse"
        />
      )}
    </svg>
  )
}
