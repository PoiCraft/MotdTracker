import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/api/endpoints"
import type { GroupItem } from "@/api/types"

interface ServerGroupContextValue {
  groups: GroupItem[]
  selectedGroupId: string | null
  selectGroup: (id: string | null) => void
  isLoading: boolean
}

const ServerGroupContext = createContext<ServerGroupContextValue | null>(null)
const STORAGE_KEY = "motdtracker_selected_group"

export function ServerGroupProvider({ children }: { children: ReactNode }) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === "null" || saved === "" ? null : saved
  })

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: api.groups.list,
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, selectedGroupId ?? "")
  }, [selectedGroupId])

  const selectGroup = (id: string | null) => {
    setSelectedGroupId(id)
  }

  return (
    <ServerGroupContext.Provider
      value={{ groups, selectedGroupId, selectGroup, isLoading }}
    >
      {children}
    </ServerGroupContext.Provider>
  )
}

export function useServerGroup() {
  const ctx = useContext(ServerGroupContext)
  if (!ctx) throw new Error("useServerGroup must be used within ServerGroupProvider")
  return ctx
}
