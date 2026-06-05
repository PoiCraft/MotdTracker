import { useTranslation } from "react-i18next"
import { ServerOff } from "lucide-react"

interface EmptyStateProps {
  title?: string
  description?: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-16 w-16 rounded-2xl bg-muted/40 backdrop-blur-sm flex items-center justify-center mb-4">
        <ServerOff className="h-8 w-8 text-muted-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold">{title || t("common.noData")}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          {description}
        </p>
      )}
    </div>
  )
}
