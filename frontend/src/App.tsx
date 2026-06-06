import { lazy, Suspense, type ReactNode } from "react"
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
} from "react-router-dom"
import { ThemeProvider } from "next-themes"
import { QueryProvider } from "@/providers/QueryProvider"
import { AuthProvider, useAuth } from "@/providers/AuthProvider"
import { WebSocketProvider } from "@/providers/WebSocketProvider"
import { AppStatusProvider } from "@/providers/AppStatusProvider"
import { AppShell } from "@/components/layout/AppShell"
import { ErrorBoundary } from "@/components/shared/ErrorBoundary"
import { Skeleton } from "@/components/ui/skeleton"

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}

function Fallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="space-y-4 w-full max-w-2xl p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  )
}

const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
const MonitorPage = lazy(() => import("@/pages/MonitorPage"))
const ServersPage = lazy(() => import("@/pages/ServersPage"))
const ServerDetailPage = lazy(() => import("@/pages/ServerDetailPage"))
const NodesPage = lazy(() => import("@/pages/NodesPage"))
const NodeDetailPage = lazy(() => import("@/pages/NodeDetailPage"))
const PlayersPage = lazy(() => import("@/pages/PlayersPage"))
const PlayerDetailPage = lazy(() => import("@/pages/PlayerDetailPage"))
const BadgesPage = lazy(() => import("@/pages/BadgesPage"))
const LoginPage = lazy(() => import("@/pages/LoginPage"))
const AdminPage = lazy(() => import("@/pages/AdminPage"))
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"))

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "monitor", element: <MonitorPage /> },
      { path: "servers", element: <ServersPage /> },
      { path: "servers/:serverId", element: <ServerDetailPage /> },
      { path: "nodes", element: <NodesPage /> },
      { path: "nodes/:nodeId", element: <NodeDetailPage /> },
      { path: "players", element: <PlayersPage /> },
      { path: "players/:playerName", element: <PlayerDetailPage /> },
      { path: "badges", element: <BadgesPage /> },
      { path: "login", element: <LoginPage /> },
      {
        path: "admin",
        element: (
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        ),
      },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryProvider>
        <AuthProvider>
          <AppStatusProvider>
            <WebSocketProvider>
              <ErrorBoundary>
                <Suspense fallback={<Fallback />}>
                  <RouterProvider router={router} />
                </Suspense>
              </ErrorBoundary>
            </WebSocketProvider>
          </AppStatusProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}
