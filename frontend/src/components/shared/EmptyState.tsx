import { useTranslation } from "react-i18next"
import { ServerOff } from "lucide-react"

interface EmptyStateProps {
  title?: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <ServerOff className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">{title || t("common.noData")}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      )}
    </div>
  )
}
