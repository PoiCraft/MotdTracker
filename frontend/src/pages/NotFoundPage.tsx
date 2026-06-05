import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

export default function NotFoundPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 text-center space-y-4">
          <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
          <h2 className="text-xl font-semibold">{t("notFound.title")}</h2>
          <p className="text-muted-foreground">{t("notFound.description")}</p>
          <Button onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t("notFound.backHome")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
