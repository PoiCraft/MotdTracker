import { describe, it, expect } from "vitest"
import type { StatusLog, NodeWithStats, PlayerSessionHistory } from "@/api/types"
import {
  aggregateServerHistory,
  buildLatencyChartData,
  extractLatestOnlinePlayers,
  parseSamplePlayers,
  aggregateHistory,
  aggregateHourly,
  computeSessionStats,
  LATENCY_CHART_COLORS,
} from "./history"

function log(overrides: Partial<StatusLog>): StatusLog {
  return {
    id: 1,
    node_id: "n1",
    timestamp: "2026-07-30 12:00:00",
    online: true,
    latency: 42,
    players_online: 3,
    players_max: 20,
    version: null,
    motd: null,
    sample_players: null,
    software: null,
    plugins: null,
    map: null,
    edition: null,
    ...overrides,
  }
}

function node(overrides: Partial<NodeWithStats>): NodeWithStats {
  return {
    id: "n1",
    server_id: "s1",
    name: "Node 1",
    host: "localhost",
    port: 25565,
    edition: "java",
    color: null,
    enabled: true,
    sort_order: 0,
    latest_status: null,
    latency_stats: null,
    ...overrides,
  } as NodeWithStats
}

describe("parseSamplePlayers", () => {
  it("解析合法 JSON 数组", () => {
    expect(parseSamplePlayers('["a","b"]')).toEqual(["a", "b"])
  })

  it("null/空串/非法 JSON 返回空数组", () => {
    expect(parseSamplePlayers(null)).toEqual([])
    expect(parseSamplePlayers("")).toEqual([])
    expect(parseSamplePlayers("{not json")).toEqual([])
  })
})

describe("aggregateServerHistory", () => {
  it("空历史返回空数组", () => {
    expect(aggregateServerHistory([], 3)).toEqual([])
  })

  it("同一时间戳下每个节点只计最新一条，且只统计在线节点", () => {
    const history = [
      log({ node_id: "n1", timestamp: "2026-07-30 12:00:00", online: true, players_online: 5 }),
      log({ node_id: "n2", timestamp: "2026-07-30 12:00:00", online: false, players_online: 9 }),
      log({ node_id: "n1", timestamp: "2026-07-30 12:01:00", online: true, players_online: 7 }),
    ]
    const points = aggregateServerHistory(history, 2)
    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ onlineNodes: 1, totalPlayers: 5, totalNodes: 2 })
    expect(points[1]).toMatchObject({ onlineNodes: 1, totalPlayers: 7, totalNodes: 2 })
  })

  it("按时间升序输出", () => {
    const history = [
      log({ timestamp: "2026-07-30 12:02:00" }),
      log({ timestamp: "2026-07-30 12:00:00" }),
    ]
    const points = aggregateServerHistory(history, 1)
    expect(points).toHaveLength(2)
    expect(new Date("2026-07-30 12:00:00").getTime()).toBeLessThan(
      new Date("2026-07-30 12:02:00").getTime()
    )
  })
})

describe("buildLatencyChartData", () => {
  it("空历史返回空数据", () => {
    expect(buildLatencyChartData([], [node({})])).toEqual({ data: [], nodes: [] })
  })

  it("离线或无延迟的节点数据点为 null（图表断线）", () => {
    const history = [
      log({ node_id: "n1", timestamp: "2026-07-30 12:00:00", online: true, latency: 42.4 }),
      log({ node_id: "n1", timestamp: "2026-07-30 12:01:00", online: false, latency: null }),
    ]
    const { data } = buildLatencyChartData(history, [node({ id: "n1" })])
    expect(data[0]["n1"]).toBe(42)
    expect(data[1]["n1"]).toBeNull()
  })

  it("节点配置颜色优先，未配置时按调色板取色", () => {
    const history = [log({ node_id: "n1" }), log({ node_id: "n2" })]
    const { nodes } = buildLatencyChartData(history, [
      node({ id: "n1", color: "#123456" }),
      node({ id: "n2" }),
    ])
    expect(nodes[0].color).toBe("#123456")
    expect(nodes[1].color).toBe(LATENCY_CHART_COLORS[1])
  })

  it("历史中出现但节点列表没有的 id 被追加", () => {
    const history = [log({ node_id: "ghost" })]
    const { nodes } = buildLatencyChartData(history, [])
    expect(nodes.map((n) => n.id)).toEqual(["ghost"])
  })
})

describe("extractLatestOnlinePlayers", () => {
  it("从最新到最旧收集 sample_players，去重并排序", () => {
    const history = [
      log({ players_online: 1, sample_players: '["zoe","amy"]' }),
      log({ players_online: 2, sample_players: '["amy","bob"]' }),
    ]
    expect(extractLatestOnlinePlayers(history)).toEqual(["amy", "bob", "zoe"])
  })

  it("跳过 players_online 为 0/空 的记录和非法 JSON", () => {
    const history = [
      log({ players_online: 0, sample_players: '["ghost"]' }),
      log({ players_online: 1, sample_players: "{broken" }),
      log({ players_online: 1, sample_players: '["ok"]' }),
    ]
    expect(extractLatestOnlinePlayers(history)).toEqual(["ok"])
  })
})

describe("aggregateHistory", () => {
  it("空输入返回空序列", () => {
    expect(aggregateHistory([])).toEqual({ onlineNodes: [], totalPlayers: [] })
    expect(aggregateHistory([[]])).toEqual({ onlineNodes: [], totalPlayers: [] })
  })

  it("窗口内每个节点只计最新一条，跨服务器累加", () => {
    const s1 = [
      log({ node_id: "n1", timestamp: "2026-07-30 10:00:00", online: true, players_online: 2 }),
      log({ node_id: "n1", timestamp: "2026-07-30 10:00:07", online: false, players_online: 0 }),
    ]
    const s2 = [
      log({ node_id: "n2", timestamp: "2026-07-30 10:00:02", online: true, players_online: 4 }),
    ]
    // range=7s, step=3.5s：窗口1 [00,03.5) 窗口2 [03.5,07)
    // 窗口1：n1@00 在线 2 人；n2@02 在线 4 人 → 2 节点 6 人
    // 窗口2：n1 最新@07 离线（不计）；n2 无新记录 → 0 节点 0 人
    const { onlineNodes, totalPlayers } = aggregateHistory([s1, s2], 2)
    expect(onlineNodes).toEqual([2, 0])
    expect(totalPlayers).toEqual([6, 0])
  })
})

describe("aggregateHourly", () => {
  it("始终返回 24 个桶", () => {
    expect(aggregateHourly([])).toHaveLength(24)
  })

  it("跨小时的会话在边界处切分", () => {
    // 本地时间 10:30 - 12:15：10 点 30 分钟，11 点 60 分钟，12 点 15 分钟
    const start = new Date(2026, 6, 30, 10, 30, 0)
    const end = new Date(2026, 6, 30, 12, 15, 0)
    const buckets = aggregateHourly([
      { session_start: start.toString(), session_end: end.toString() },
    ])
    expect(buckets[10].minutes).toBe(30)
    expect(buckets[11].minutes).toBe(60)
    expect(buckets[12].minutes).toBe(15)
    expect(buckets[9].minutes).toBe(0)
  })

  it("end <= start 的会话被跳过", () => {
    const t = new Date(2026, 6, 30, 10, 0, 0).toString()
    const buckets = aggregateHourly([{ session_start: t, session_end: t }])
    expect(buckets.every((b) => b.minutes === 0)).toBe(true)
  })

  it("跨午夜的会话按本地小时正确分桶（23 点与次日 0/1 点）", () => {
    const start = new Date(2026, 6, 30, 23, 30, 0)
    const end = new Date(2026, 6, 31, 1, 15, 0)
    const buckets = aggregateHourly([
      { session_start: start.toString(), session_end: end.toString() },
    ])
    expect(buckets[23].minutes).toBe(30)
    expect(buckets[0].minutes).toBe(60)
    expect(buckets[1].minutes).toBe(15)
    expect(buckets[22].minutes).toBe(0)
  })
})

describe("computeSessionStats", () => {
  function session(
    overrides: Partial<Omit<PlayerSessionHistory, "session_end">> & {
      session_end?: string | null
    }
  ): PlayerSessionHistory {
    return {
      id: 1,
      server_id: "s1",
      player_name: "p",
      session_start: "2026-07-30 10:00:00",
      session_end: "2026-07-30 11:00:00",
      ...overrides,
    } as PlayerSessionHistory
  }

  it("平均与最长只计已结束的会话", () => {
    const stats = computeSessionStats([
      session({ session_end: "2026-07-30 11:00:00" }), // 3600s
      session({ session_end: "2026-07-30 12:00:00" }), // 7200s
      session({ session_end: null }), // 进行中，不计入
    ])
    expect(stats.avg).toBe(5400)
    expect(stats.longest).toBe(7200)
  })

  it("favorite 取会话次数最多的服务器", () => {
    const stats = computeSessionStats([
      session({ server_id: "s1" }),
      session({ server_id: "s1" }),
      session({ server_id: "s2" }),
    ])
    expect(stats.favorite).toBe("s1")
    expect(stats.favCount).toBe(2)
  })

  it("空会话返回零值", () => {
    expect(computeSessionStats([])).toEqual({ avg: 0, longest: 0, favorite: "", favCount: 0 })
  })
})
