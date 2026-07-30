import { useSearchParams } from "react-router-dom"

/** 统一读取 ?group_id 组过滤参数；所有列表页经此 hook 消费 */
export function useGroupFilter(): string | null {
  const [searchParams] = useSearchParams()
  return searchParams.get("group_id")
}
