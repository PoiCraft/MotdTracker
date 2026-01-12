import './BadgesPage.css'

function BadgesPage() {
  const serverName = 'PoiCraft'
  const badgeTypes = [
    { type: 'status', label: '在线状态' },
    { type: 'players', label: '玩家数量' },
    { type: 'latency', label: '延迟' },
    { type: 'uptime', label: '在线率' },
  ]

  const getBadgeUrl = (type: string) => {
    return `/api/badge/${type}`
  }

  const getBadgeMarkdown = (type: string) => {
    return `![${serverName} ${type}](${window.location.origin}${getBadgeUrl(type)})`
  }

  const getBadgeHTML = (type: string) => {
    return `<img src="${window.location.origin}${getBadgeUrl(type)}" alt="${serverName} ${type}" />`
  }

  return (
    <div className="badges-page">
      <div className="page-header">
        <h1>Badge 生成器</h1>
        <p className="page-description">为您的项目生成服务器状态徽章</p>
      </div>

      <div className="badges-grid">
        {badgeTypes.map(({ type, label }) => (
          <div key={type} className="badge-card">
            <h3>{label}</h3>
            <div className="badge-preview">
              <img src={getBadgeUrl(type)} alt={`${serverName} ${label}`} />
            </div>
            <div className="badge-code">
              <div className="code-section">
                <div className="code-label">Markdown:</div>
                <code className="code-block">{getBadgeMarkdown(type)}</code>
              </div>
              <div className="code-section">
                <div className="code-label">HTML:</div>
                <code className="code-block">{getBadgeHTML(type)}</code>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BadgesPage
