import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { api } from "@/api/endpoints"
import { useAuth } from "@/providers/AuthProvider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, Shield } from "lucide-react"

export default function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { login, setup, error, loading } = useAuth()
  const [initialized, setInitialized] = useState<boolean | null>(null)
  const [isSetup, setIsSetup] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [localError, setLocalError] = useState("")

  useEffect(() => {
    api.admin
      .status()
      .then((res) => {
        setInitialized(res.initialized)
        setIsSetup(!res.initialized)
      })
      .catch(() => setInitialized(true))
  }, [])

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
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Authentication failed"
      if (message.includes("409")) {
        setIsSetup(false)
        setInitialized(true)
        setLocalError("Account already exists. Please login.")
      } else {
        setLocalError(message)
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.15) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.15) 1px, transparent 1px)
          `,
          backgroundSize: "24px 24px",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,var(--background)_70%)]" />

      <Card className="w-full max-w-sm relative bg-card/80 backdrop-blur-xl border border-border/60 shadow-2xl transition-all duration-300">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-lg bg-foreground text-background flex items-center justify-center">
            <Shield className="h-5 w-5" />
          </div>
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
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("login.password")}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="bg-background/50"
              />
            </div>

            {(error || localError) && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{localError || error}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full transition-all duration-300"
              disabled={loading || initialized === null}
            >
              {loading
                ? t("login.signingIn")
                : isSetup
                ? t("login.createAccount")
                : t("login.signIn")}
            </Button>

            {initialized === false && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs transition-all duration-300"
                onClick={() => {
                  setIsSetup(!isSetup)
                  setLocalError("")
                }}
              >
                {isSetup ? t("login.signIn") : t("login.createAccount")}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
