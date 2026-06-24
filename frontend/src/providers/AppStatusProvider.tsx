import { createContext, useContext, useEffect, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/endpoints"

interface AppStatusContextType {
  serverName: string
}

const AppStatusContext = createContext<AppStatusContextType>({ serverName: "MotdTracker" })

export function AppStatusProvider({ children }: { children: ReactNode }) {
  const { data: status } = useQuery({
    queryKey: ["app-status"],
    queryFn: api.status,
    staleTime: 60_000,
  })

  const serverName = status?.server_name || "MotdTracker"

  useEffect(() => {
    document.title = serverName
  }, [serverName])

  return (
    <AppStatusContext.Provider value={{ serverName }}>
      {children}
    </AppStatusContext.Provider>
  )
}

export function useAppStatus() {
  return useContext(AppStatusContext)
}
