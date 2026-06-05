import { Component, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />
    }
    return this.props.children
  }
}

function ErrorFallback({ error }: { error: Error | null }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="h-16 w-16 rounded-2xl bg-destructive/10 backdrop-blur-sm flex items-center justify-center mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">{t("common.error")}</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-md text-center">
        {error?.message || "Something went wrong"}
      </p>
      <Button
        className="mt-4 transition-all duration-300"
        onClick={() => window.location.reload()}
      >
        Reload
      </Button>
    </div>
  )
}
