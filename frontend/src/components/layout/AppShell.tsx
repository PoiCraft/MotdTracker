import { Suspense } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { TopBar } from "./TopBar"
import { BottomNav } from "./BottomNav"
import { CommandPalette } from "./CommandPalette"
import { Skeleton } from "@/components/ui/skeleton"

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
  const isLogin = location.pathname === "/login"

  if (isLogin) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-6">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
      <CommandPalette />
    </div>
  )
}
