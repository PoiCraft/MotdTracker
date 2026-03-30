import { NavLink } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useColorMode } from "../color-mode";

/**
 * Material You 导航配置
 */
const navItems = [
  { 
    to: "/server", 
    label: "总览", 
    icon: <HomeRoundedIcon />,
    description: "服务器状态监控"
  },
  { 
    to: "/nodes", 
    label: "节点", 
    icon: <DnsRoundedIcon />,
    description: "节点管理与监控"
  },
  { 
    to: "/players", 
    label: "玩家", 
    icon: <GroupsRoundedIcon />,
    description: "玩家数据统计"
  },
  { 
    to: "/badges", 
    label: "徽章", 
    icon: <BadgeRoundedIcon />,
    description: "生成状态徽章"
  }
];

const drawerWidth = 280;

/**
 * Material You 风格的布局组件
 * 
 * 特性:
 * 1. 响应式导航抽屉
 * 2. 顶部应用栏 (移动端)
 * 3. 主题切换功能
 * 4. 当前页面高亮指示
 */
export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { mode, toggleMode } = useColorMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isDark = mode === "dark";

  // 计算当前页面标题
  const currentNav = useMemo(() => {
    return navItems.find((item) => location.pathname.startsWith(item.to));
  }, [location.pathname]);

  const currentTitle = currentNav?.label || "MotdTracker";

  // 导航项点击处理
  const handleNavClick = () => {
    if (isMobile) {
      setOpen(false);
    }
  };

  /**
   * 抽屉内容组件
   */
  const drawerContent = (
    <Stack sx={{ height: "100%" }}>
      {/* 应用头部 */}
      <Box sx={{ px: 2.5, py: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          {/* 应用图标 */}
          <Avatar
            sx={{
              width: 48,
              height: 48,
              bgcolor: isDark
                ? alpha(theme.palette.primary.main, 0.18)
                : theme.palette.primaryContainer?.main || alpha(theme.palette.primary.main, 0.12),
              color: isDark
                ? theme.palette.primary.light
                : theme.palette.primary.dark
            }}
          >
            <HubRoundedIcon sx={{ fontSize: 28 }} />
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                fontSize: "1.125rem",
                lineHeight: 1.4,
                color: "text.primary"
              }}
            >
              MotdTracker
            </Typography>
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
                fontSize: "0.75rem"
              }}
            >
              Material You App
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ mx: 2.5, mb: 1 }} />

      {/* 导航列表 */}
      <List
        component="nav"
        sx={{
          px: 1.5,
          flex: 1,
          "& .MuiListItemButton-root": {
            py: 1.25,
            px: 2,
            mb: 0.5,
            borderRadius: 28,
            transition: theme.transitions.create([
              "background-color",
              "color",
              "transform"
            ], {
              duration: theme.transitions.duration.short
            }),
            "&.active": {
              bgcolor: isDark
                ? alpha(theme.palette.primary.main, 0.18)
                : theme.palette.primaryContainer?.main || alpha(theme.palette.primary.main, 0.12),
              color: isDark
                ? theme.palette.primary.light
                : theme.palette.primary.dark,
              "& .MuiListItemIcon-root": {
                color: isDark
                  ? theme.palette.primary.light
                  : theme.palette.primary.dark
              },
              "& .MuiListItemText-primary": {
                fontWeight: 600
              },
              "&::before": {
                content: '""',
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                width: 3,
                height: 32,
                borderRadius: "0 3px 3px 0",
                bgcolor: theme.palette.primary.main
              }
            },
            "&:hover": {
              bgcolor: isDark
                ? alpha(theme.palette.surface?.on || "#fff", 0.08)
                : alpha(theme.palette.primary.main, 0.08),
              transform: "scale(1.01)"
            },
            "&:active": {
              transform: "scale(0.99)"
            }
          }
        }}
      >
        {navItems.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton
              component={NavLink}
              to={item.to}
              onClick={handleNavClick}
              sx={{
                position: "relative"
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: "inherit"
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                secondary={item.description}
                secondaryTypographyProps={{
                  sx: {
                    fontSize: "0.6875rem",
                    color: "text.secondary",
                    lineHeight: 1.3,
                    mt: 0.25
                  }
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider sx={{ mx: 2.5, my: 1 }} />

      {/* 底部操作区 */}
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        {/* 主题切换按钮 */}
        <ListItemButton
          onClick={toggleMode}
          sx={{
            borderRadius: 16,
            py: 1.5,
            px: 2,
            mb: 1
          }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>
            {isDark ? (
              <LightModeRoundedIcon sx={{ color: "warning.main" }} />
            ) : (
              <DarkModeRoundedIcon />
            )}
          </ListItemIcon>
          <ListItemText
            primary={isDark ? "浅色模式" : "深色模式"}
            secondary={isDark ? "切换到浅色主题" : "切换到深色主题"}
            secondaryTypographyProps={{
              sx: {
                fontSize: "0.6875rem",
                color: "text.secondary"
              }
            }}
          />
        </ListItemButton>

        {/* 版本信息 */}
        <Box
          sx={{
            mt: 2,
            px: 1.5,
            py: 1.5,
            borderRadius: 2,
            bgcolor: isDark
              ? alpha(theme.palette.surface?.variant || "#333", 0.3)
              : alpha(theme.palette.primary.main, 0.04)
          }}
        >
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.secondary",
              fontSize: "0.6875rem",
              lineHeight: 1.4
            }}
          >
            前后端分离重构版
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.disabled",
              fontSize: "0.625rem",
              mt: 0.5
            }}
          >
            Built with Material You
          </Typography>
        </Box>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* 移动端顶部应用栏 */}
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          display: { xs: "block", md: "none" },
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.85),
          backdropFilter: "blur(12px)"
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton
            edge="start"
            onClick={() => setOpen(true)}
            sx={{
              bgcolor: isDark
                ? alpha(theme.palette.surface?.on || "#fff", 0.05)
                : alpha(theme.palette.primary.main, 0.05),
              "&:hover": {
                bgcolor: isDark
                  ? alpha(theme.palette.surface?.on || "#fff", 0.1)
                  : alpha(theme.palette.primary.main, 0.1)
              }
            }}
          >
            <MenuRoundedIcon />
          </IconButton>
          
          <Typography
            variant="h6"
            sx={{
              flex: 1,
              fontWeight: 600,
              fontSize: "1.125rem"
            }}
          >
            {currentTitle}
          </Typography>
          
          <Tooltip
            title={isDark ? "切换到浅色" : "切换到深色"}
            arrow
          >
            <IconButton
              onClick={toggleMode}
              sx={{
                bgcolor: isDark
                  ? alpha(theme.palette.surface?.on || "#fff", 0.05)
                  : alpha(theme.palette.primary.main, 0.05),
                "&:hover": {
                  bgcolor: isDark
                    ? alpha(theme.palette.surface?.on || "#fff", 0.1)
                    : alpha(theme.palette.primary.main, 0.1)
                }
              }}
            >
              {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* 移动端临时抽屉 */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.95),
            backdropFilter: "blur(10px)"
          }
        }}
      >
        {drawerContent}
      </Drawer>

      {/* 桌面端永久抽屉 */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider",
            bgcolor: "background.paper"
          }
        }}
      >
        {drawerContent}
      </Drawer>

      {/* 主内容区域 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          p: { xs: 2, md: 3 },
          pt: { xs: 10, md: 3 },
          bgcolor: "background.default"
        }}
      >
        <main className="content" style={{ flex: 1 }}>
          {children}
        </main>
        
        {/* 页脚 */}
        <Box
          component="footer"
          sx={{
            mt: "auto",
            pt: 3,
            pb: 1,
            textAlign: "center"
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: "text.disabled",
              fontSize: "0.6875rem"
            }}
          >
            © {new Date().getFullYear()} MotdTracker · Powered by Material You
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
