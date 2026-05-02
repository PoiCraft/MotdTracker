import { useMemo, useState, useCallback, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import { useColorMode } from "../color-mode";
import { useWsEvent } from "../utils/ws";
import M3StatusTag from "./M3StatusTag";
import { LayoutContext } from "./LayoutContext";

const navItems = [
  { to: "/server", label: "总览", icon: <HomeRoundedIcon /> },
  { to: "/nodes", label: "节点", icon: <DnsRoundedIcon /> },
  { to: "/players", label: "玩家", icon: <GroupsRoundedIcon /> },
  { to: "/badges", label: "徽章", icon: <BadgeRoundedIcon /> },
];

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 88;
const ICON_AREA_W = 56;

const MOBILE_BREAKPOINT = "sm";
const TABLET_BREAKPOINT = "md";

function NavItem({ item, onClick, open }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const isActive = useLocation().pathname.startsWith(item.to);

  return (
    <ListItem disablePadding sx={{ mb: 0.5, px: 2 }}>
      <ListItemButton
        component={NavLink}
        to={item.to}
        onClick={onClick}
        sx={{
          minHeight: 48,
          borderRadius: 100,
          justifyContent: "flex-start",
          px: 0,
          color: isActive ? c?.onPrimaryContainer : c?.onSurfaceVariant,
          "&:hover": {
            backgroundColor: isActive
              ? "transparent"
              : alpha(c?.onSurface || "#000", 0.08),
          },
        }}
      >
        <Box
          sx={{
            width: ICON_AREA_W,
            minWidth: ICON_AREA_W,
            height: 32,
            borderRadius: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            backgroundColor: isActive
              ? c?.primaryContainer
              : "transparent",
            transition: theme.transitions.create("background-color", {
              duration: theme.transitions.duration.shortest,
            }),
          }}
        >
          <ListItemIcon
            sx={{
              minWidth: 0,
              width: 24,
              height: 24,
              color: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {item.icon}
          </ListItemIcon>
        </Box>

        <Box
          sx={{
            ml: 0.75,
            overflow: "hidden",
            whiteSpace: "nowrap",
            width: open ? 120 : 0,
            opacity: open ? 1 : 0,
            transition: theme.transitions.create(
              ["width", "opacity", "margin-left"],
              {
                duration: theme.transitions.duration.standard,
                easing: theme.transitions.easing.emphasized,
              }
            ),
          }}
        >
          <Typography
            component="span"
            sx={{
              fontSize: "0.875rem",
              fontWeight: isActive ? 600 : 500,
              letterSpacing: "0.01em",
              color: "inherit",
              display: "block",
            }}
          >
            {item.label}
          </Typography>
        </Box>
      </ListItemButton>
    </ListItem>
  );
}

function SidebarContent({ onNavClick, open, onToggle, isMobile }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const isDark = theme.gemini?.isDark;
  const { toggleMode } = useColorMode();
  const wsState = useWsEvent(() => {});

  const showText = isMobile ? true : open;

  return (
    <Stack sx={{ height: "100%" }}>
      <Box
        sx={{
          height: 64,
          px: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          flexShrink: 0,
        }}
      >
        {!isMobile && (
          <Box
            sx={{
              width: ICON_AREA_W,
              minWidth: ICON_AREA_W,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconButton
              onClick={onToggle}
              size="small"
              sx={{
                width: 40,
                height: 40,
                color: c?.onSurfaceVariant,
                "&:hover": {
                  backgroundColor: alpha(c?.onSurface || "#000", 0.08),
                },
              }}
            >
              {open ? (
                <ChevronLeftRoundedIcon sx={{ fontSize: 20 }} />
              ) : (
                <MenuRoundedIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>
          </Box>
        )}

        {isMobile && (
          <>
            <Avatar
              sx={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                bgcolor: c?.primaryContainer,
                color: c?.onPrimaryContainer,
                flexShrink: 0,
              }}
            >
              <HubRoundedIcon sx={{ fontSize: 20 }} />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.2,
                  fontSize: "0.9375rem",
                }}
              >
                MotdTracker
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: c?.onSurfaceVariant }}
              >
                服务器监控
              </Typography>
            </Box>
          </>
        )}
      </Box>

      <List sx={{ flex: 1, px: 0 }}>
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            onClick={onNavClick}
            open={showText}
          />
        ))}
      </List>

      <Box
        sx={{
          px: 2,
          pb: 1,
          overflow: "hidden",
        }}
      >
        {showText ? (
          <>
            <M3StatusTag online={wsState === "connected"} size={isMobile ? "small" : open ? "large" : "small"} />
            {!isMobile && (
              <Typography
                variant="caption"
                sx={{
                  display: "block",
                  mt: 0.5,
                  color: c?.onSurfaceVariant,
                  fontSize: "0.6875rem",
                  opacity: open ? 1 : 0,
                  transition: theme.transitions.create("opacity", {
                    duration: theme.transitions.duration.shorter,
                  }),
                }}
              >
                {__APP_VERSION__}
              </Typography>
            )}
          </>
        ) : (
          <Tooltip
            title={wsState === "connected" ? "已连接" : "未连接"}
            placement="right"
            arrow
          >
            <Box sx={{ py: 0.5, display: "flex", justifyContent: "center", width: ICON_AREA_W }}>
              <M3StatusTag online={wsState === "connected"} size="small" hideText />
            </Box>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ px: 2, pb: 1, flexShrink: 0 }}>
        <Tooltip
          title={isDark ? "浅色模式" : "深色模式"}
          placement={showText ? "top" : "right"}
          arrow
        >
          <ListItemButton
            onClick={toggleMode}
            sx={{
              borderRadius: 100,
              minHeight: 48,
              justifyContent: "flex-start",
              px: 0,
              color: c?.onSurfaceVariant,
              "&:hover": {
                backgroundColor: alpha(c?.onSurface || "#000", 0.08),
              },
            }}
          >
            <Box
              sx={{
                width: ICON_AREA_W,
                minWidth: ICON_AREA_W,
                height: 32,
                borderRadius: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                backgroundColor: "transparent",
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  width: 24,
                  height: 24,
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
              </ListItemIcon>
            </Box>

            <Box
              sx={{
                ml: 0.75,
                overflow: "hidden",
                whiteSpace: "nowrap",
                width: showText ? 120 : 0,
                opacity: showText ? 1 : 0,
                transition: theme.transitions.create(
                  ["width", "opacity", "margin-left"],
                  {
                    duration: theme.transitions.duration.standard,
                    easing: theme.transitions.easing.emphasized,
                  }
                ),
              }}
            >
              <Typography
                component="span"
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  display: "block",
                }}
              >
                {isDark ? "浅色模式" : "深色模式"}
              </Typography>
            </Box>
          </ListItemButton>
        </Tooltip>
      </Box>
    </Stack>
  );
}

function MobileBottomNav({ currentPath }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;

  const activeIdx = navItems.findIndex((i) => currentPath.startsWith(i.to));
  const navValue = activeIdx >= 0 ? activeIdx : 0;

  return (
    <Paper
      elevation={0}
      sx={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: theme.zIndex.drawer + 1,
        bgcolor: c?.surfaceContainer,
        borderTop: `1px solid ${c?.outlineVariant}`,
        backgroundImage: "none",
        pb: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <BottomNavigation
        value={navValue}
        showLabels
        sx={{
          bgcolor: "transparent",
          height: 64,
          "& .MuiBottomNavigationAction-root": {
            color: c?.onSurfaceVariant,
            minWidth: "auto",
            px: 1,
            "&.Mui-selected": {
              color: c?.onPrimaryContainer,
            },
          },
          "& .MuiBottomNavigationAction-label": {
            fontSize: "0.6875rem",
            "&.Mui-selected": {
              fontSize: "0.75rem",
              fontWeight: 600,
            },
          },
        }}
      >
        {navItems.map((item) => (
          <BottomNavigationAction
            key={item.to}
            component={NavLink}
            to={item.to}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </BottomNavigation>
    </Paper>
  );
}

export default function Layout({ children }) {
  const [userToggled, setUserToggled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const location = useLocation();

  const isMobile = useMediaQuery(theme.breakpoints.down(MOBILE_BREAKPOINT));
  const isTablet = useMediaQuery(
    theme.breakpoints.between(MOBILE_BREAKPOINT, TABLET_BREAKPOINT)
  );
  const isDesktop = useMediaQuery(theme.breakpoints.up(TABLET_BREAKPOINT));

  const autoOpen = isDesktop && !isTablet;
  const open = userToggled ? !autoOpen : autoOpen;

  const drawerWidth = isMobile
    ? 0
    : open
    ? EXPANDED_WIDTH
    : COLLAPSED_WIDTH;

  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [isMobile]);

  const handleToggle = useCallback(() => {
    setUserToggled((prev) => !prev);
  }, []);

  const handleNavClick = useCallback(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  const currentTitle = useMemo(() => {
    const match = navItems.find((i) => location.pathname.startsWith(i.to));
    return match?.label || "MotdTracker";
  }, [location.pathname]);

  const layoutValue = useMemo(
    () => ({ drawerWidth, isMobile, isTablet, isDesktop }),
    [drawerWidth, isMobile, isTablet, isDesktop]
  );

  return (
    <LayoutContext.Provider value={layoutValue}>
      <Box
        sx={{
          display: "flex",
          minHeight: "100vh",
          bgcolor: c?.background,
        }}
      >
        {/* ─── Mobile top bar ─────────────────────────────────────────── */}
        <AppBar
          position="fixed"
          sx={{
            display: { xs: "flex", sm: "none" },
            bgcolor: c?.background,
            color: c?.onSurface,
            boxShadow: "none",
            borderBottom: "none",
          }}
        >
          <Toolbar sx={{ gap: 1 }}>
            <IconButton onClick={() => setMobileOpen(true)} edge="start">
              <MenuRoundedIcon />
            </IconButton>
            <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
              {currentTitle}
            </Typography>
            <ThemeToggle />
          </Toolbar>
        </AppBar>

        {/* ─── Mobile temporary drawer ────────────────────────────────── */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              width: EXPANDED_WIDTH,
              bgcolor: c?.background,
              borderRight: "none",
              boxShadow: "none",
            },
          }}
        >
          <SidebarContent
            onNavClick={handleNavClick}
            open={true}
            onToggle={() => setMobileOpen(false)}
            isMobile={true}
          />
        </Drawer>

        {/* ─── Desktop/Tablet collapsible drawer ──────────────────────── */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            width: drawerWidth,
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              width: drawerWidth,
              bgcolor: c?.background,
              borderRight: "none",
              boxShadow: "none",
              overflowX: "hidden",
              transition: theme.transitions.create("width", {
                easing: theme.transitions.easing.emphasized,
                duration: theme.transitions.duration.standard,
              }),
            },
          }}
        >
          <SidebarContent
            onNavClick={handleNavClick}
            open={open}
            onToggle={handleToggle}
            isMobile={false}
          />
        </Drawer>

        {/* ─── Main content ───────────────────────────────────────────── */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
            bgcolor: c?.background,
            width: { xs: "100%", sm: `calc(100% - ${drawerWidth}px)` },
            transition: theme.transitions.create("width", {
              easing: theme.transitions.easing.emphasized,
              duration: theme.transitions.duration.standard,
            }),
          }}
        >
          {/* Spacer for mobile AppBar */}
          <Box sx={{ display: { xs: "block", sm: "none" }, height: 64 }} />

          <Box
            className="page-content"
            sx={{
              flex: 1,
              px: { xs: 2, md: 3, lg: 4 },
              py: { xs: 2, md: 3 },
              maxWidth: 1440,
              width: "100%",
              mx: "auto",
              pb: { xs: "calc(64px + env(safe-area-inset-bottom, 0px) + 16px)", sm: 3 },
            }}
          >
            {children}
          </Box>
        </Box>

        {/* ─── Mobile bottom navigation ───────────────────────────────── */}
        {isMobile && (
          <MobileBottomNav currentPath={location.pathname} />
        )}
      </Box>
    </LayoutContext.Provider>
  );
}

function ThemeToggle() {
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === "dark";

  return (
    <Tooltip title={isDark ? "浅色模式" : "深色模式"} arrow>
      <IconButton onClick={toggleMode}>
        {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
      </IconButton>
    </Tooltip>
  );
}
