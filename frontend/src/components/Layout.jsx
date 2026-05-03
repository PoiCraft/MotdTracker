import { useMemo, useState, useCallback, useEffect } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import ChevronLeftRoundedIcon from "@mui/icons-material/ChevronLeftRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import { api } from "../api";
import { useColorMode } from "../color-mode";
import { useWsEvent } from "../utils/ws";
import { StatusDot } from "./M3StatusTag";
import { LayoutContext } from "./LayoutContext";

const navItems = [
  { to: "/server", label: "总览", icon: <HomeRoundedIcon /> },
  { to: "/nodes", label: "节点", icon: <DnsRoundedIcon /> },
  { to: "/players", label: "玩家", icon: <GroupsRoundedIcon /> },
  { to: "/badges", label: "徽章", icon: <BadgeRoundedIcon /> },
];

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 88;

const INDICATOR_HEIGHT = "48px";
const INDICATOR_HORIZONTAL_PADDING = "16px";
const COLLAPSED_INDICATOR_WIDTH = "56px";
const INDICATOR_BORDER_RADIUS = "100px";

const MOBILE_BREAKPOINT = "sm";
const TABLET_BREAKPOINT = "md";

function getPageTitle(pathname) {
  if (pathname === "/server" || pathname.startsWith("/server/")) return "总览";
  if (pathname === "/nodes") return "节点";
  if (pathname.startsWith("/nodes/")) return "节点详情";
  if (pathname === "/players") return "玩家";
  if (pathname.startsWith("/players/") || pathname.startsWith("/player/")) return "玩家详情";
  if (pathname === "/badges") return "徽章";
  return "页面";
}

function getBackPath(pathname) {
  if (pathname.startsWith("/nodes/")) return "/nodes";
  if (pathname.startsWith("/players/") || pathname.startsWith("/player/")) return "/players";
  return null;
}

function NavItem({ item, onClick, open }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const isActive = useLocation().pathname.startsWith(item.to);

  const activeColor = c?.primary || "#1A73E8";
  const activeBg = alpha(activeColor, 0.1);
  const neutralColor = "#444746";
  const inactiveHover = alpha(c?.onSurface || "#000", 0.04);

  const capsuleTransition = theme.transitions.create(["background-color"], {
    duration: theme.transitions.duration.standard,
    easing: theme.transitions.easing.emphasized,
  });

  return (
    <ListItem disablePadding sx={{ my: "4px" }}>
      <ListItemButton
        component={NavLink}
        to={item.to}
        onClick={onClick}
        sx={{
          height: INDICATOR_HEIGHT,
          width: "100%",
          borderRadius: INDICATOR_BORDER_RADIUS,
          overflow: "hidden",
          px: "8px",
          justifyContent: "flex-start",
          backgroundColor: isActive ? activeBg : "transparent",
          color: isActive ? activeColor : neutralColor,
          transition: capsuleTransition,
          "& .MuiTouchRipple-root": {
            borderRadius: INDICATOR_BORDER_RADIUS,
          },
          "&:hover": {
            backgroundColor: isActive ? activeBg : inactiveHover,
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: "40px",
            color: "inherit",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {item.icon}
        </ListItemIcon>

        <Box
          sx={{
            minWidth: 0,
            overflow: "hidden",
            maxWidth: open ? 96 : 0,
            opacity: open ? 1 : 0,
            transform: open ? "translateX(0)" : "translateX(-6px)",
            transition: theme.transitions.create(
              ["opacity", "max-width", "transform"],
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
              fontWeight: isActive ? 700 : 500,
              letterSpacing: "0.01em",
              color: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </Typography>
        </Box>
      </ListItemButton>
    </ListItem>
  );
}

function SidebarContent({ onNavClick, open, onToggle, isMobile, serverName }) {
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const isDark = theme.gemini?.isDark;
  const { toggleMode } = useColorMode();
  const wsState = useWsEvent(() => {});
  const isConnected = wsState === "connected";
  const statusLabel = isConnected ? "在线" : "离线";
  const statusColor = isConnected
    ? theme.palette.success.main
    : theme.palette.error.main;
  const statusTextColor = isConnected
    ? theme.palette.success.dark || theme.palette.success.main
    : theme.palette.error.dark || theme.palette.error.main;

  const showText = isMobile ? true : open;
  const displayServerName = serverName.trim();

  return (
    <Stack sx={{ height: "100%", px: 2, overflowX: "hidden", whiteSpace: "nowrap" }}>
      {/* Header area with toggle */}
      <Box
        sx={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          flexShrink: 0,
        }}
      >
        {!isMobile && (
          <Box
            sx={{
              width: COLLAPSED_INDICATOR_WIDTH,
              minWidth: COLLAPSED_INDICATOR_WIDTH,
              display: "flex",
              alignItems: "center",
              justifyContent: open ? "flex-start" : "center",
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
                ml: open ? "8px" : 0,
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

        {showText && (
          <>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  lineHeight: 1.2,
                  fontSize: "0.9375rem",
                }}
              >
                {displayServerName || "服务器监控"}
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

      <List sx={{ flex: 1 }}>
        {navItems.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            onClick={onNavClick}
            open={showText}
          />
        ))}
      </List>

      <Box sx={{ pb: 1, flexShrink: 0 }}>
        <ListItem disablePadding sx={{ my: "4px" }}>
          <Box
            sx={{
              height: INDICATOR_HEIGHT,
              width: "100%",
              borderRadius: INDICATOR_BORDER_RADIUS,
              overflow: "hidden",
              px: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              color: "#444746",
            }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "flex-start",
                maxWidth: showText ? "132px" : "24px",
                height: "24px",
                borderRadius: showText ? 100 : "50%",
                bgcolor: alpha(statusColor, 0.12),
                color: statusTextColor,
                ml: 1,
                pr: showText ? 1.25 : 0,
                overflow: "hidden",
                whiteSpace: "nowrap",
                transition: `${theme.transitions.create("max-width", {
                  duration: theme.transitions.duration.standard,
                  easing: theme.transitions.easing.emphasized,
                })}, ${theme.transitions.create("border-radius", {
                  duration: theme.transitions.duration.standard,
                  easing: theme.transitions.easing.emphasized,
                })}, ${theme.transitions.create("padding-right", {
                  duration: theme.transitions.duration.standard,
                  easing: theme.transitions.easing.emphasized,
                })}`,
                transitionDelay: showText ? "40ms" : "120ms",
              }}
            >
              <Box
                sx={{
                  width: "24px",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <StatusDot online={isConnected} size={isMobile ? 8 : 10} />
              </Box>

              <Box
                sx={{
                  minWidth: 0,
                  overflow: "hidden",
                  maxWidth: showText ? 86 : 0,
                  opacity: showText ? 1 : 0,
                  transform: showText ? "translateX(0)" : "translateX(-6px)",
                  transition: theme.transitions.create(
                    ["opacity", "max-width", "transform"],
                    {
                      duration: theme.transitions.duration.shorter,
                      easing: theme.transitions.easing.emphasized,
                    }
                  ),
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    display: "block",
                    ml: 0.25,
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {statusLabel}
                </Typography>
              </Box>
            </Box>
          </Box>
        </ListItem>
      </Box>

      <Box sx={{ pb: 1, flexShrink: 0 }}>
        <ListItem disablePadding sx={{ my: "4px" }}>
          <ListItemButton
            onClick={toggleMode}
            sx={{
              height: INDICATOR_HEIGHT,
              width: "100%",
              borderRadius: INDICATOR_BORDER_RADIUS,
              overflow: "hidden",
              px: "8px",
              justifyContent: "flex-start",
              color: "#444746",
              transition: theme.transitions.create(
                ["background-color"],
                {
                  duration: theme.transitions.duration.standard,
                  easing: theme.transitions.easing.emphasized,
                }
              ),
              "& .MuiTouchRipple-root": {
                borderRadius: INDICATOR_BORDER_RADIUS,
              },
              "&:hover": {
                backgroundColor: alpha(c?.onSurface || "#000", 0.04),
              },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: "40px",
                color: "inherit",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
            </ListItemIcon>

            <Box
              sx={{
                minWidth: 0,
                overflow: "hidden",
                maxWidth: showText ? 120 : 0,
                opacity: showText ? 1 : 0,
                transform: showText ? "translateX(0)" : "translateX(-6px)",
                transition: theme.transitions.create(
                  ["opacity", "max-width", "transform"],
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
                  whiteSpace: "nowrap",
                }}
              >
                {isDark ? "浅色模式" : "深色模式"}
              </Typography>
            </Box>
          </ListItemButton>
        </ListItem>
      </Box>
    </Stack>
  );
}

export default function Layout({ children }) {
  const [userToggled, setUserToggled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [serverName, setServerName] = useState("");
  const theme = useTheme();
  const c = theme.gemini?.colors;
  const location = useLocation();
  const navigate = useNavigate();

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

  useEffect(() => {
    let alive = true;

    api.server
      .head(1)
      .then((data) => {
        if (!alive) return;
        setServerName(data?.config?.server_name?.trim() || "");
      })
      .catch(() => {
        if (!alive) return;
        setServerName("");
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleToggle = useCallback(() => {
    setUserToggled((prev) => !prev);
  }, []);

  const handleNavClick = useCallback(() => {
    if (isMobile) setMobileOpen(false);
  }, [isMobile]);

  const currentTitle = useMemo(() => getPageTitle(location.pathname), [location.pathname]);
  const backPath = useMemo(() => getBackPath(location.pathname), [location.pathname]);

  const browserTitle = useMemo(() => {
    if (!serverName) return currentTitle;
    return `${currentTitle} - ${serverName}`;
  }, [currentTitle, serverName]);

  useEffect(() => {
    document.title = browserTitle;
  }, [browserTitle]);

  const layoutValue = useMemo(
    () => ({ drawerWidth, isMobile, isTablet, isDesktop }),
    [drawerWidth, isMobile, isTablet, isDesktop]
  );

  const layoutTransition = theme.transitions.create(["margin", "width"], {
    easing: theme.transitions.easing.emphasized,
    duration: theme.transitions.duration.standard,
  });

  const sidebarTransition = theme.transitions.create("width", {
    easing: theme.transitions.easing.emphasized,
    duration: theme.transitions.duration.standard,
  });

  return (
    <LayoutContext.Provider value={layoutValue}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          height: "100vh",
          width: "100vw",
          overflow: "hidden",
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
            {backPath ? (
              <IconButton onClick={() => navigate(backPath)} edge="start">
                <ArrowBackRoundedIcon />
              </IconButton>
            ) : (
              <IconButton onClick={() => setMobileOpen(true)} edge="start">
                <MenuRoundedIcon />
              </IconButton>
            )}
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
            serverName={serverName}
          />
        </Drawer>

        {/* ─── Desktop/Tablet sidebar with flex push ──────────────────── */}
        <Box
          component="aside"
          sx={{
            display: { xs: "none", sm: "block" },
            width: drawerWidth,
            flexShrink: 0,
            overflow: "hidden",
            transition: sidebarTransition,
            willChange: "width",
            bgcolor: c?.background,
          }}
        >
          <Box sx={{ height: "100%", overflow: "hidden" }}>
            <SidebarContent
              onNavClick={handleNavClick}
              open={open}
              onToggle={handleToggle}
              isMobile={false}
              serverName={serverName}
            />
          </Box>
        </Box>

        {/* ─── Main content ───────────────────────────────────────────── */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: "100vh",
            bgcolor: c?.background,
            overflowX: "hidden",
            overflowY: "auto",
            willChange: "margin, width",
            transition: layoutTransition,
          }}
        >
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
              pb: 3,
            }}
          >
            {children}
          </Box>

          {/* ─── Page footer with version ─────────────────────────────── */}
          <Box
            component="footer"
            sx={{
              py: 1.5,
              px: { xs: 2, md: 3, lg: 4 },
              textAlign: "center",
              color: c?.onSurfaceVariant,
              fontSize: "0.6875rem",
              opacity: 0.5,
              pb: 1.5,
            }}
          >
            {__APP_VERSION__}
          </Box>
        </Box>
      </Box>
    </LayoutContext.Provider>
  );
}

function ThemeToggle() {
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === "dark";

  return (
    <IconButton onClick={toggleMode}>
      {isDark ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
    </IconButton>
  );
}
