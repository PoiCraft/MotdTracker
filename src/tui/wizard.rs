use std::io;
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Clear, List, ListItem, ListState, Paragraph, Wrap},
    Frame, Terminal,
};

use crate::config::{AppConfig, DatabaseConfig, NodeConfig, ServerEdition};

#[derive(Clone, Copy, PartialEq, Eq)]
enum Step {
    Welcome,
    ServerName,
    Port,
    PollInterval,
    DatabasePath,
    Nodes,
    Review,
}

struct NodeEditState {
    name: String,
    host: String,
    port: String,
    edition: ServerEdition,
    color: String,
    field: NodeField,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum NodeField {
    Name,
    Host,
    Port,
    Edition,
    Color,
}

struct WizardState {
    step: Step,
    server_name: String,
    port: String,
    poll_interval: String,
    db_path: String,
    nodes: Vec<NodeConfig>,
    node_list_state: ListState,
    node_edit: Option<NodeEditState>,
    input: String,
    cursor_pos: usize,
    message: Option<(String, bool)>,
}

impl WizardState {
    fn new() -> Self {
        let mut list_state = ListState::default();
        list_state.select(Some(0));
        Self {
            step: Step::Welcome,
            server_name: "MotdTracker".to_string(),
            port: "5011".to_string(),
            poll_interval: "60".to_string(),
            db_path: "data/motdtracker.db".to_string(),
            nodes: Vec::new(),
            node_list_state: list_state,
            node_edit: None,
            input: String::new(),
            cursor_pos: 0,
            message: None,
        }
    }

    fn to_config(&self) -> AppConfig {
        AppConfig {
            server_name: self.server_name.clone(),
            database: DatabaseConfig {
                path: self.db_path.clone(),
            },
            poll_interval: self.poll_interval.parse().unwrap_or(60),
            port: self.port.parse().unwrap_or(5011),
            nodes: self.nodes.clone(),
            napcat_alert: None,
            umami: None,
        }
    }

    fn insert_char(&mut self, c: char) {
        if self.cursor_pos <= self.input.len() && self.input.is_char_boundary(self.cursor_pos) {
            self.input.insert(self.cursor_pos, c);
            self.cursor_pos += c.len_utf8();
        }
    }

    fn move_cursor_left(&mut self) {
        if self.cursor_pos > 0 {
            let prev = self.input[..self.cursor_pos]
                .char_indices()
                .last()
                .map(|(i, _)| i)
                .unwrap_or(0);
            self.cursor_pos = prev;
        }
    }

    fn move_cursor_right(&mut self) {
        if self.cursor_pos < self.input.len() {
            let next = self.input[self.cursor_pos..]
                .char_indices()
                .nth(1)
                .map(|(i, _)| self.cursor_pos + i)
                .unwrap_or(self.input.len());
            self.cursor_pos = next;
        }
    }

    fn delete_char_before(&mut self) {
        if self.cursor_pos > 0 {
            let prev = self.input[..self.cursor_pos]
                .char_indices()
                .last()
                .map(|(i, _)| i)
                .unwrap_or(0);
            self.input.drain(prev..self.cursor_pos);
            self.cursor_pos = prev;
        }
    }

    fn delete_char_after(&mut self) {
        if self.cursor_pos < self.input.len() {
            let end = self.input[self.cursor_pos..]
                .char_indices()
                .nth(1)
                .map(|(i, _)| self.cursor_pos + i)
                .unwrap_or(self.input.len());
            self.input.drain(self.cursor_pos..end);
        }
    }
}

pub fn run_wizard() -> io::Result<Option<AppConfig>> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let result = run_app(&mut terminal);

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    result
}

fn run_app(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> io::Result<Option<AppConfig>> {
    let mut state = WizardState::new();

    loop {
        terminal.draw(|f| ui(f, &mut state))?;

        if let Event::Key(key) = event::read()? {
            if key.kind != KeyEventKind::Press {
                continue;
            }

            if key.modifiers.contains(KeyModifiers::CONTROL) && key.code == KeyCode::Char('c') {
                return Ok(None);
            }

            match state.step {
                Step::Welcome => match key.code {
                    KeyCode::Enter | KeyCode::Char(' ') => {
                        state.step = Step::ServerName;
                        state.input = state.server_name.clone();
                        state.cursor_pos = state.input.len();
                    }
                    KeyCode::Esc | KeyCode::Char('q') => return Ok(None),
                    _ => {}
                },
                Step::ServerName => match key.code {
                    KeyCode::Enter => {
                        if !state.input.trim().is_empty() {
                            state.server_name = state.input.trim().to_string();
                            state.step = Step::Port;
                            state.input = state.port.clone();
                            state.cursor_pos = state.input.len();
                        }
                    }
                    KeyCode::Esc => {
                        state.step = Step::Welcome;
                    }
                    KeyCode::Char(c) => {
                        state.insert_char(c);
                    }
                    KeyCode::Backspace => {
                        state.delete_char_before();
                    }
                    KeyCode::Delete => {
                        state.delete_char_after();
                    }
                    KeyCode::Left => {
                        state.move_cursor_left();
                    }
                    KeyCode::Right => {
                        state.move_cursor_right();
                    }
                    KeyCode::Home => state.cursor_pos = 0,
                    KeyCode::End => state.cursor_pos = state.input.len(),
                    _ => {}
                },
                Step::Port => match key.code {
                    KeyCode::Enter => {
                        if state.input.parse::<u16>().is_ok() {
                            state.port = state.input.clone();
                            state.step = Step::PollInterval;
                            state.input = state.poll_interval.clone();
                            state.cursor_pos = state.input.len();
                        } else {
                            state.message = Some(("端口必须是 0-65535 的数字".to_string(), true));
                        }
                    }
                    KeyCode::Esc => {
                        state.step = Step::ServerName;
                        state.input = state.server_name.clone();
                        state.cursor_pos = state.input.len();
                        state.message = None;
                    }
                    KeyCode::Char(c) if c.is_ascii_digit() => {
                        state.insert_char(c);
                        state.message = None;
                    }
                    KeyCode::Backspace => {
                        state.delete_char_before();
                    }
                    KeyCode::Delete => {
                        state.delete_char_after();
                    }
                    KeyCode::Left => {
                        state.move_cursor_left();
                    }
                    KeyCode::Right => {
                        state.move_cursor_right();
                    }
                    KeyCode::Home => state.cursor_pos = 0,
                    KeyCode::End => state.cursor_pos = state.input.len(),
                    _ => {}
                },
                Step::PollInterval => match key.code {
                    KeyCode::Enter => {
                        if let Ok(v) = state.input.parse::<u64>() {
                            if v > 0 {
                                state.poll_interval = state.input.clone();
                                state.step = Step::DatabasePath;
                                state.input = state.db_path.clone();
                                state.cursor_pos = state.input.len();
                                state.message = None;
                            } else {
                                state.message = Some(("轮询间隔必须大于 0".to_string(), true));
                            }
                        } else {
                            state.message = Some(("请输入有效的数字".to_string(), true));
                        }
                    }
                    KeyCode::Esc => {
                        state.step = Step::Port;
                        state.input = state.port.clone();
                        state.cursor_pos = state.input.len();
                        state.message = None;
                    }
                    KeyCode::Char(c) if c.is_ascii_digit() => {
                        state.insert_char(c);
                        state.message = None;
                    }
                    KeyCode::Backspace => {
                        state.delete_char_before();
                    }
                    KeyCode::Delete => {
                        state.delete_char_after();
                    }
                    KeyCode::Left => {
                        state.move_cursor_left();
                    }
                    KeyCode::Right => {
                        state.move_cursor_right();
                    }
                    KeyCode::Home => state.cursor_pos = 0,
                    KeyCode::End => state.cursor_pos = state.input.len(),
                    _ => {}
                },
                Step::DatabasePath => match key.code {
                    KeyCode::Enter => {
                        if !state.input.trim().is_empty() {
                            state.db_path = state.input.trim().to_string();
                            state.step = Step::Nodes;
                            state.input.clear();
                            state.cursor_pos = 0;
                        }
                    }
                    KeyCode::Esc => {
                        state.step = Step::PollInterval;
                        state.input = state.poll_interval.clone();
                        state.cursor_pos = state.input.len();
                    }
                    KeyCode::Char(c) => {
                        state.insert_char(c);
                    }
                    KeyCode::Backspace => {
                        state.delete_char_before();
                    }
                    KeyCode::Delete => {
                        state.delete_char_after();
                    }
                    KeyCode::Left => {
                        state.move_cursor_left();
                    }
                    KeyCode::Right => {
                        state.move_cursor_right();
                    }
                    KeyCode::Home => state.cursor_pos = 0,
                    KeyCode::End => state.cursor_pos = state.input.len(),
                    _ => {}
                },
                Step::Nodes => {
                    if state.node_edit.is_some() {
                        handle_node_edit(&mut state, key);
                    } else {
                        match key.code {
                            KeyCode::Esc => {
                                state.step = Step::DatabasePath;
                                state.input = state.db_path.clone();
                                state.cursor_pos = state.input.len();
                            }
                            KeyCode::Char('n') => {
                                let next_id = state.nodes.iter().map(|n| n.id).max().unwrap_or(0) + 1;
                                state.node_edit = Some(NodeEditState {
                                    name: String::new(),
                                    host: String::new(),
                                    port: "25565".to_string(),
                                    edition: ServerEdition::Java,
                                    color: String::new(),
                                    field: NodeField::Name,
                                });
                                state.input.clear();
                                state.cursor_pos = 0;
                                let _ = next_id;
                            }
                            KeyCode::Char('d') | KeyCode::Delete => {
                                if let Some(selected) = state.node_list_state.selected() {
                                    if selected < state.nodes.len() {
                                        state.nodes.remove(selected);
                                        let new_len = state.nodes.len();
                                        if new_len == 0 {
                                            state.node_list_state.select(None);
                                        } else if selected >= new_len {
                                            state.node_list_state.select(Some(new_len - 1));
                                        }
                                    }
                                }
                            }
                            KeyCode::Char('e') => {
                                if let Some(selected) = state.node_list_state.selected() {
                                    if selected < state.nodes.len() {
                                        let node = &state.nodes[selected];
                                        state.node_edit = Some(NodeEditState {
                                            name: node.name.clone(),
                                            host: node.host.clone(),
                                            port: node.port.to_string(),
                                            edition: node.edition.clone(),
                                            color: node.color.clone().unwrap_or_default(),
                                            field: NodeField::Name,
                                        });
                                        state.input = node.name.clone();
                                        state.cursor_pos = state.input.len();
                                    }
                                }
                            }
                            KeyCode::Up | KeyCode::Char('k') => {
                                if let Some(selected) = state.node_list_state.selected() {
                                    if selected > 0 {
                                        state.node_list_state.select(Some(selected - 1));
                                    }
                                }
                            }
                            KeyCode::Down | KeyCode::Char('j') => {
                                if let Some(selected) = state.node_list_state.selected() {
                                    if selected + 1 < state.nodes.len() {
                                        state.node_list_state.select(Some(selected + 1));
                                    }
                                }
                            }
                            KeyCode::Enter | KeyCode::Tab => {
                                state.step = Step::Review;
                            }
                            _ => {}
                        }
                    }
                }
                Step::Review => match key.code {
                    KeyCode::Esc => {
                        state.step = Step::Nodes;
                    }
                    KeyCode::Char('s') | KeyCode::Enter => {
                        let config = state.to_config();
                        let toml_str = match toml::to_string_pretty(&config) {
                            Ok(s) => s,
                            Err(e) => {
                                state.message = Some((format!("序列化失败: {}", e), true));
                                continue;
                            }
                        };
                        if let Err(e) = std::fs::write("config.toml", &toml_str) {
                            state.message = Some((format!("写入文件失败: {}", e), true));
                            continue;
                        }
                        return Ok(Some(config));
                    }
                    KeyCode::Char('q') => return Ok(None),
                    _ => {}
                },
            }
        }
    }
}

fn handle_node_edit(state: &mut WizardState, key: event::KeyEvent) {
    if state.node_edit.is_none() {
        return;
    }

    match key.code {
        KeyCode::Esc => {
            state.node_edit = None;
            state.input.clear();
            state.cursor_pos = 0;
            state.step = Step::Nodes;
        }
        KeyCode::Tab => {
            save_current_node_field(state);
            let edit = state.node_edit.as_mut().unwrap();
            edit.field = match edit.field {
                NodeField::Name => NodeField::Host,
                NodeField::Host => NodeField::Port,
                NodeField::Port => NodeField::Edition,
                NodeField::Edition => NodeField::Color,
                NodeField::Color => NodeField::Name,
            };
            load_current_node_field(state);
        }
        KeyCode::BackTab => {
            save_current_node_field(state);
            let edit = state.node_edit.as_mut().unwrap();
            edit.field = match edit.field {
                NodeField::Name => NodeField::Color,
                NodeField::Host => NodeField::Name,
                NodeField::Port => NodeField::Host,
                NodeField::Edition => NodeField::Port,
                NodeField::Color => NodeField::Edition,
            };
            load_current_node_field(state);
        }
        KeyCode::Enter if matches!(state.node_edit.as_ref().unwrap().field, NodeField::Edition) => {
            let edit = state.node_edit.as_mut().unwrap();
            edit.edition = match edit.edition {
                ServerEdition::Java => ServerEdition::Bedrock,
                ServerEdition::Bedrock => ServerEdition::Java,
            };
        }
        KeyCode::Enter => {
            save_current_node_field(state);
            let edit = state.node_edit.as_ref().unwrap();
            if edit.name.trim().is_empty() || edit.host.trim().is_empty() {
                state.message = Some(("节点名称和地址不能为空".to_string(), true));
                return;
            }
            let port: u16 = edit.port.parse().unwrap_or(25565);
            let color = if edit.color.trim().is_empty() {
                None
            } else {
                Some(edit.color.trim().to_string())
            };

            let new_node = NodeConfig {
                id: state.nodes.iter().map(|n| n.id).max().unwrap_or(0) + 1,
                name: edit.name.clone(),
                host: edit.host.clone(),
                port,
                edition: edit.edition.clone(),
                color,
                enable: true,
            };

            if let Some(existing) = state.nodes.iter_mut().find(|n| n.name == new_node.name) {
                *existing = new_node;
            } else {
                state.nodes.push(new_node);
                state.node_list_state.select(Some(state.nodes.len() - 1));
            }
            state.node_edit = None;
            state.input.clear();
            state.cursor_pos = 0;
            state.message = None;
        }
        KeyCode::Char(c)
            if !matches!(state.node_edit.as_ref().unwrap().field, NodeField::Edition) =>
        {
            state.insert_char(c);
        }
        KeyCode::Backspace => {
            state.delete_char_before();
        }
        KeyCode::Delete => {
            state.delete_char_after();
        }
        KeyCode::Left => {
            state.move_cursor_left();
        }
        KeyCode::Right => {
            state.move_cursor_right();
        }
        KeyCode::Home => state.cursor_pos = 0,
        KeyCode::End => state.cursor_pos = state.input.len(),
        _ => {}
    }
}

fn save_current_node_field(state: &mut WizardState) {
    if let Some(edit) = &mut state.node_edit {
        match edit.field {
            NodeField::Name => edit.name = state.input.clone(),
            NodeField::Host => edit.host = state.input.clone(),
            NodeField::Port => edit.port = state.input.clone(),
            NodeField::Color => edit.color = state.input.clone(),
            NodeField::Edition => {}
        }
    }
}

fn load_current_node_field(state: &mut WizardState) {
    if let Some(edit) = &state.node_edit {
        state.input = match edit.field {
            NodeField::Name => edit.name.clone(),
            NodeField::Host => edit.host.clone(),
            NodeField::Port => edit.port.clone(),
            NodeField::Color => edit.color.clone(),
            NodeField::Edition => String::new(),
        };
        state.cursor_pos = state.input.len();
    }
}

fn ui(f: &mut Frame, state: &mut WizardState) {
    let size = f.area();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(10),
            Constraint::Length(3),
        ])
        .split(size);

    let title = Paragraph::new("  MotdTracker 配置向导")
        .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD))
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::DarkGray)));

    f.render_widget(title, chunks[0]);

    match state.step {
        Step::Welcome => draw_welcome(f, chunks[1]),
        Step::ServerName => draw_text_input(f, chunks[1], "服务器名称", &state.input, state.cursor_pos, "输入 MotdTracker 实例的显示名称"),
        Step::Port => draw_text_input(f, chunks[1], "Web 端口", &state.input, state.cursor_pos, "输入 Web 服务监听端口 (0-65535)"),
        Step::PollInterval => draw_text_input(f, chunks[1], "轮询间隔 (秒)", &state.input, state.cursor_pos, "输入服务器状态轮询间隔"),
        Step::DatabasePath => draw_text_input(f, chunks[1], "数据库路径", &state.input, state.cursor_pos, "输入 SQLite 数据库文件路径"),
        Step::Nodes => draw_nodes(f, chunks[1], state),
        Step::Review => draw_review(f, chunks[1], state),
    }

    let footer_text = match state.step {
        Step::Welcome => "Enter: 开始  |  Esc/Ctrl+C: 退出",
        Step::ServerName | Step::Port | Step::PollInterval | Step::DatabasePath => {
            "Enter: 确认  |  Esc: 返回  |  Ctrl+C: 退出"
        }
        Step::Nodes if state.node_edit.is_some() => {
            "Tab: 下一字段  |  Shift+Tab: 上一字段  |  Enter: 保存节点  |  Esc: 取消"
        }
        Step::Nodes => {
            "n: 添加节点  |  e: 编辑  |  d: 删除  |  ↑↓: 选择  |  Tab/Enter: 下一步  |  Esc: 返回"
        }
        Step::Review => "s/Enter: 保存并启动  |  Esc: 返回修改  |  q/Ctrl+C: 退出",
    };
    let footer = Paragraph::new(footer_text)
        .style(Style::default().fg(Color::DarkGray))
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::DarkGray)));
    f.render_widget(footer, chunks[2]);

    if let Some((msg, is_err)) = &state.message {
        let color = if *is_err { Color::Red } else { Color::Green };
        let msg_area = centered_rect(60, 3, size);
        let msg_para = Paragraph::new(msg.as_str())
            .style(Style::default().fg(color))
            .alignment(ratatui::layout::Alignment::Center)
            .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(color)));
        f.render_widget(Clear, msg_area);
        f.render_widget(msg_para, msg_area);
    }
}

fn draw_welcome(f: &mut Frame, area: Rect) {
    let text = vec![
        Line::from(""),
        Line::from(Span::styled(
            "欢迎使用 MotdTracker!",
            Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD),
        )),
        Line::from(""),
        Line::from("此向导将引导你完成首次配置。"),
        Line::from("配置完成后将自动生成 config.toml 文件。"),
        Line::from(""),
        Line::from(Span::styled(
            "按 Enter 开始...",
            Style::default().fg(Color::Green),
        )),
    ];
    let para = Paragraph::new(text)
        .alignment(ratatui::layout::Alignment::Center)
        .wrap(Wrap { trim: true })
        .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::DarkGray)));
    f.render_widget(para, area);
}

fn draw_text_input(f: &mut Frame, area: Rect, label: &str, value: &str, cursor: usize, hint: &str) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(2),
            Constraint::Min(0),
        ])
        .margin(1)
        .split(area);

    let hint_para = Paragraph::new(hint)
        .style(Style::default().fg(Color::DarkGray));
    f.render_widget(hint_para, chunks[2]);

    let input_block = Block::default()
        .title(format!(" {} ", label))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::Cyan));

    let inner = input_block.inner(chunks[1]);
    f.render_widget(input_block, chunks[1]);

    let display_text = if value.is_empty() {
        Span::styled("_", Style::default().fg(Color::DarkGray))
    } else {
        Span::raw(value)
    };
    let para = Paragraph::new(display_text);
    f.render_widget(para, inner);

    if cursor < value.len() {
        f.set_cursor_position((inner.x + cursor as u16, inner.y));
    } else {
        f.set_cursor_position((inner.x + value.len() as u16, inner.y));
    }
}

fn draw_nodes(f: &mut Frame, area: Rect, state: &mut WizardState) {
    if state.node_edit.is_some() {
        draw_node_edit(f, area, state);
        return;
    }

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2),
            Constraint::Min(5),
            Constraint::Length(2),
        ])
        .margin(1)
        .split(area);

    let header = Paragraph::new("节点配置 - 同一服务器的不同连接入口")
        .style(Style::default().fg(Color::Yellow));
    f.render_widget(header, chunks[0]);

    if state.nodes.is_empty() {
        let empty = Paragraph::new("暂无节点，按 'n' 添加第一个节点")
            .style(Style::default().fg(Color::DarkGray))
            .alignment(ratatui::layout::Alignment::Center)
            .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::DarkGray)));
        f.render_widget(empty, chunks[1]);
    } else {
        let items: Vec<ListItem> = state
            .nodes
            .iter()
            .map(|n| {
                let edition_color = match n.edition {
                    ServerEdition::Java => Color::Green,
                    ServerEdition::Bedrock => Color::Magenta,
                };
                let status = if n.enable { "✓" } else { "✗" };
                let line = Line::from(vec![
                    Span::raw(format!(" {} ", status)),
                    Span::styled(format!("[{}] ", n.id), Style::default().fg(Color::DarkGray)),
                    Span::styled(&n.name, Style::default().add_modifier(Modifier::BOLD)),
                    Span::raw(format!("  {}:{} ", n.host, n.port)),
                    Span::styled(
                        format!("{:?}", n.edition),
                        Style::default().fg(edition_color),
                    ),
                ]);
                ListItem::new(line)
            })
            .collect();

        let list = List::new(items)
            .block(
                Block::default()
                    .title(" 节点列表 ")
                    .borders(Borders::ALL)
                    .border_style(Style::default().fg(Color::Cyan)),
            )
            .highlight_style(Style::default().bg(Color::DarkGray).add_modifier(Modifier::BOLD))
            .highlight_symbol("▶ ");

        f.render_stateful_widget(list, chunks[1], &mut state.node_list_state);
    }

    let tip = Paragraph::new(format!(
        "已配置 {} 个节点  |  ID 是节点的唯一标识，不同节点使用相同 ID 会导致数据混乱",
        state.nodes.len()
    ))
    .style(Style::default().fg(Color::DarkGray));
    f.render_widget(tip, chunks[2]);
}

fn draw_node_edit(f: &mut Frame, area: Rect, state: &mut WizardState) {
    let edit = match &state.node_edit {
        Some(e) => e,
        None => return,
    };

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Length(3),
            Constraint::Min(0),
        ])
        .margin(1)
        .split(area);

    let title = Paragraph::new("编辑节点配置")
        .style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD));
    f.render_widget(title, chunks[0]);

    let fields = [
        ("节点名称", &edit.name, edit.field == NodeField::Name),
        ("节点地址", &edit.host, edit.field == NodeField::Host),
        ("端口", &edit.port, edit.field == NodeField::Port),
        ("版本类型", &format!("{:?}", edit.edition), edit.field == NodeField::Edition),
        ("颜色 (可选)", &edit.color, edit.field == NodeField::Color),
    ];

    for (i, (label, value, active)) in fields.iter().enumerate() {
        let border_color = if *active { Color::Cyan } else { Color::DarkGray };
        let block = Block::default()
            .title(format!(" {} ", label))
            .borders(Borders::ALL)
            .border_style(Style::default().fg(border_color));

        let inner = block.inner(chunks[i + 1]);
        f.render_widget(block, chunks[i + 1]);

        if *label == "版本类型" {
            let edition_color = match edit.edition {
                ServerEdition::Java => Color::Green,
                ServerEdition::Bedrock => Color::Magenta,
            };
            let text = Paragraph::new(Span::styled(
                format!("{:?} (按 Enter 切换)", edit.edition),
                Style::default().fg(edition_color),
            ));
            f.render_widget(text, inner);
        } else if *active {
            let display_value = state.input.as_str();
            let display = if display_value.is_empty() {
                Span::styled("_", Style::default().fg(Color::DarkGray))
            } else {
                Span::raw(display_value)
            };
            f.render_widget(Paragraph::new(display), inner);
            f.set_cursor_position((inner.x + state.cursor_pos as u16, inner.y));
        } else {
            f.render_widget(Paragraph::new(value.as_str()), inner);
        }
    }
}

fn draw_review(f: &mut Frame, area: Rect, state: &WizardState) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(2),
            Constraint::Min(5),
            Constraint::Length(2),
        ])
        .margin(1)
        .split(area);

    let header = Paragraph::new("配置确认 - 按 s 保存并启动")
        .style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD));
    f.render_widget(header, chunks[0]);

    let mut lines = vec![
        Line::from(vec![
            Span::styled("服务器名称: ", Style::default().fg(Color::DarkGray)),
            Span::styled(&state.server_name, Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("Web 端口:   ", Style::default().fg(Color::DarkGray)),
            Span::styled(&state.port, Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("轮询间隔:   ", Style::default().fg(Color::DarkGray)),
            Span::styled(format!("{} 秒", state.poll_interval), Style::default().fg(Color::White)),
        ]),
        Line::from(vec![
            Span::styled("数据库路径: ", Style::default().fg(Color::DarkGray)),
            Span::styled(&state.db_path, Style::default().fg(Color::White)),
        ]),
        Line::from(""),
        Line::from(Span::styled(
            format!("节点 ({} 个):", state.nodes.len()),
            Style::default().fg(Color::Cyan),
        )),
    ];

    for node in &state.nodes {
        let edition_color = match node.edition {
            ServerEdition::Java => Color::Green,
            ServerEdition::Bedrock => Color::Magenta,
        };
        lines.push(Line::from(vec![
            Span::raw(format!("  • {} ", node.name)),
            Span::styled(format!("[{:?}]", node.edition), Style::default().fg(edition_color)),
            Span::raw(format!(" {}:{} ", node.host, node.port)),
        ]));
    }

    let review = Paragraph::new(lines)
        .block(
            Block::default()
                .title(" 配置概览 ")
                .borders(Borders::ALL)
                .border_style(Style::default().fg(Color::Cyan)),
        );
    f.render_widget(review, chunks[1]);

    let tip = Paragraph::new("配置将保存到 config.toml")
        .style(Style::default().fg(Color::DarkGray));
    f.render_widget(tip, chunks[2]);
}

fn centered_rect(percent_x: u16, height: u16, r: Rect) -> Rect {
    let popup_layout = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length((r.height.saturating_sub(height)) / 2),
            Constraint::Length(height),
            Constraint::Length((r.height.saturating_sub(height)) / 2),
        ])
        .split(r);

    Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage((100 - percent_x) / 2),
            Constraint::Percentage(percent_x),
            Constraint::Percentage((100 - percent_x) / 2),
        ])
        .split(popup_layout[1])[1]
}
