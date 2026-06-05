import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Ghost } from "lucide-react"

export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="max-w-md w-full bg-card/60 backdrop-blur-md border border-border/80 shadow-sm dark:bg-card/60">
        <CardContent className="p-8 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-muted/40 backdrop-blur-sm flex items-center justify-center">
            <Ghost className="h-8 w-8 text-muted-foreground/60" />
          </div>
          <h1 className="text-6xl font-bold font-mono text-muted-foreground/40">
            404
          </h1>
          <h2 className="text-xl font-semibold">{t("notFound.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("notFound.description")}
          </p>
          <Button
            onClick={() => navigate("/dashboard")}
            className="transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("notFound.backHome")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
