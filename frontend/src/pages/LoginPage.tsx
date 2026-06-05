import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login, setup, error, loading } = useAuth()
  const [isSetup, setIsSetup] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [localError, setLocalError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLocalError("")
    try {
      if (isSetup) {
        await setup(username, password)
      } else {
        await login(username, password)
      }
      navigate("/dashboard")
    } catch (e: any) {
      if (e.message?.includes("409")) {
        setIsSetup(false)
        setLocalError("Account already exists. Please login.")
      } else {
        setLocalError(e.message || "Authentication failed")
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">
            {isSetup ? t("login.setupTitle") : t("login.title")}
          </CardTitle>
          {isSetup && (
            <p className="text-sm text-muted-foreground">
              {t("login.setupDescription")}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("login.username")}</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("login.password")}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {(error || localError) && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{localError || error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading
                ? t("login.signingIn")
                : isSetup
                ? t("login.createAccount")
                : t("login.signIn")}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full text-xs"
              onClick={() => {
                setIsSetup(!isSetup)
                setLocalError("")
              }}
            >
              {isSetup ? t("login.signIn") : t("login.createAccount")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
