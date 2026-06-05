import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { PageHeader } from "@/components/shared/PageHeader"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { useServerGroup } from "@/providers/ServerGroupProvider"
import { Copy, Check } from "lucide-react"
import type { NodeWithStats } from "@/api/types"

const NODE_BADGE_TYPES = [
  { value: "status", label: "Status" },
  { value: "uptime", label: "Uptime" },
  { value: "latency", label: "Latency" },
  { value: "latency-stats", label: "Latency Stats" },
  { value: "players", label: "Players" },
]

const SERVER_BADGE_TYPES = [
  { value: "server/status", label: "Server Status" },
  { value: "server/uptime", label: "Server Uptime" },
  { value: "server/players", label: "Server Players" },
]

const FORMATS = [
  { value: "url", label: "URL" },
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
]

export default function BadgesPage() {
  const { t } = useTranslation()
  const [nodes, setNodes] = useState<NodeWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState("")
  const [selectedType, setSelectedType] = useState("status")
  const [selectedFormat, setSelectedFormat] = useState("url")
  const [copied, setCopied] = useState(false)
  const { selectedGroupId } = useServerGroup()

  useEffect(() => {
    api.nodes
      .list(selectedGroupId || undefined)
      .then(setNodes)
      .finally(() => setLoading(false))
  }, [selectedGroupId])

  const baseUrl = window.location.origin

  const isServerLevel = selectedType.startsWith("server/")
  const badgeUrl = isServerLevel
    ? `${baseUrl}/api/badges/${selectedType}`
    : selectedNode
    ? `${baseUrl}/api/badges/node/${selectedNode}/${selectedType}`
    : ""

  function getFormatted(): string {
    if (!badgeUrl) return ""
    const nd = nodes.find((n) => n.id === selectedNode)
    const alt = nd ? `${nd.name} ${selectedType}` : selectedType
    switch (selectedFormat) {
      case "html":
        return `<img src="${badgeUrl}" alt="${alt}" />`
      case "markdown":
        return `![${alt}](${badgeUrl})`
      default:
        return badgeUrl
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(getFormatted())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("badges.title")}
        description={t("badges.description")}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("badges.type")}
          </label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {t("badges.serverLevel")}
              </div>
              {SERVER_BADGE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {t("badges.nodeLevel")}
              </div>
              {NODE_BADGE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isServerLevel && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("badges.node")}
            </label>
            <Select value={selectedNode} onValueChange={setSelectedNode}>
              <SelectTrigger>
                <SelectValue placeholder={t("nodes.title")} />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("badges.format")}
          </label>
          <Select value={selectedFormat} onValueChange={setSelectedFormat}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMATS.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {badgeUrl && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">{t("badges.preview")}</h3>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {t("badges.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {t("common.copy")}
                  </>
                )}
              </Button>
            </div>
            <Input value={getFormatted()} readOnly className="font-mono text-xs" />
            {selectedFormat === "html" && (
              <div className="border rounded-lg p-4 flex items-center justify-center bg-muted/30">
                <img
                  src={badgeUrl}
                  alt="Badge"
                  className="max-h-20"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = "none"
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
