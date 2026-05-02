import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
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
  useMediaQuery,
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
import { useColorMode } from "../color-mode";

const navItems = [
  { to: "/server", label: "总览", icon: <HomeRoundedIcon /> },
  { to: "/nodes", label: "节点", icon: <DnsRoundedIcon /> },
  { to: "/players", label: "玩家", icon: <GroupsRoundedIcon /> },
  { to: "/badges", label: "徽章", icon: <BadgeRoundedIcon /> },
];

const DRAWER_WIDTH = 240;
const RAIL_WIDTH = 72;

function NavItem({ item, onClick }) {
  const theme = useTheme();
  const md3 = theme.md3?.colors;
  const isDark = theme.md3?.isDark;

  return (
    <ListItem disablePadding sx={{ mb: 0.25 }}>
      <ListItemButton
        component={NavLink}
        to={item.to}
        onClick={onClick}
        sx={{
          minHeight: 48,
          px: 1.5,
          mx: 1,
          borderRadius: 28,
          position: "relative",
          gap: 1.5,
          color: md3?.onSurfaceVariant,
          "&.active": {
            backgroundColor: md3?.secondaryContainer,
            color: md3?.onSurface,
            "& .MuiListItemIcon-root": { color: md3?.onSurface },
            "& .MuiTypography-root": { fontWeight: 600 },
          },
          "&:hover": {
            backgroundColor: alpha(
              md3?.onSurface || "#000",
              0.08
            ),
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            color: "inherit",
            justifyContent: "center",
          }}
        >
          {item.icon}
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{
            fontSize: "0.875rem",
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}

function RailNavItem({ item, onClick }) {
  const theme = useTheme();
  const md3 = theme.md3?.colors;
  const isActive = useLocation().pathname.startsWith(item.to);

  return (
    <Tooltip title={item.label} placement="right" arrow>
      <Stack
        component={NavLink}
        to={item.to}
        onClick={onClick}
        alignItems="center"
        spacing={0.5}
        sx={{
          textDecoration: "none",
          color: isActive ? md3?.onSurface : md3?.onSurfaceVariant,
          py: 1,
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 32,
            borderRadius: 16,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: isActive
              ? md3?.secondaryContainer
              : "transparent",
            transition: "background-color 150ms cubic-bezier(0.2, 0, 0, 1)",
            "&:hover": {
              backgroundColor: isActive
                ? md3?.secondaryContainer
                : alpha(md3?.onSurface || "#000", 0.08),
            },
          }}
        >
          {item.icon}
        </Box>
        <Typography
          sx={{
            fontSize: "0.75rem",
            fontWeight: isActive ? 600 : 500,
            lineHeight: 1,
            letterSpacing: "0.03em",
          }}
        >
          {item.label}
        </Typography>
      </Stack>
    </Tooltip>
  );
}

function DrawerContent({ onNavClick }) {
  const theme = useTheme();
  const md3 = theme.md3?.colors;
  const isDark = theme.md3?.isDark;
  const { mode, toggleMode } = useColorMode();

  return (
    <Stack sx={{ height: "100%" }}>
      <Box sx={{ px: 2.5, py: 2, mb: 0.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              bgcolor: md3?.primaryContainer,
              color: md3?.onPrimaryContainer,
            }}
          >
            <HubRoundedIcon sx={{ fontSize: 20 }} />
          </Avatar>
          <Box>
            <Typography
              variant="subtitle1"
              sx={{ fontWeight: 600, lineHeight: 1.2, fontSize: "0.9375rem" }}
            >
              MotdTracker
            </Typography>
            <Typography
              variant="caption"
              sx={{ color: md3?.onSurfaceVariant }}
            >
              服务器监控
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Divider sx={{ mx: 2, mb: 1 }} />

      <List sx={{ flex: 1, px: 0.5 }}>
        {navItems.map((item) => (
          <NavItem key={item.to} item={item} onClick={onNavClick} />
        ))}
      </List>

      <Divider sx={{ mx: 2, mt: 1 }} />

      <Box sx={{ p: 1.5 }}>
        <ListItemButton
          onClick={toggleMode}
          sx={{
            borderRadius: 28,
            minHeight: 48,
            px: 1.5,
            gap: 1.5,
            color: md3?.onSurfaceVariant,
            "&:hover": {
              backgroundColor: alpha(md3?.onSurface || "#000", 0.08),
            },
          }}
        >
          <ListItemIcon sx={{ minWidth: 0, color: "inherit" }}>
            {isDark ? (
              <LightModeRoundedIcon />
            ) : (
              <DarkModeRoundedIcon />
            )}
          </ListItemIcon>
          <ListItemText
            primary={isDark ? "浅色模式" : "深色模式"}
            primaryTypographyProps={{
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          />
        </ListItemButton>
      </Box>
    </Stack>
  );
}

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const theme = useTheme();
  const md3 = theme.md3?.colors;
  const isDark = theme.md3?.isDark;
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const location = useLocation();

  const currentTitle = useMemo(() => {
    const match = navItems.find((i) => location.pathname.startsWith(i.to));
    return match?.label || "MotdTracker";
  }, [location.pathname]);

  const handleNavClick = () => {
    if (isMobile) setOpen(false);
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        bgcolor: md3?.surface,
      }}
    >
      {/* Mobile top bar */}
      <AppBar
        position="fixed"
        sx={{
          display: { xs: "flex", md: "none" },
          bgcolor: md3?.surfaceContainer,
          color: md3?.onSurface,
          borderBottom: `1px solid ${md3?.outlineVariant}`,
          boxShadow: "none",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton onClick={() => setOpen(true)} edge="start">
            <MenuRoundedIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1, fontWeight: 500 }}>
            {currentTitle}
          </Typography>
          <ThemeToggle />
        </Toolbar>
      </AppBar>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            bgcolor: md3?.surfaceContainerLow,
          },
        }}
      >
        <DrawerContent onNavClick={handleNavClick} />
      </Drawer>

      {/* Desktop permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: DRAWER_WIDTH,
            bgcolor: md3?.surfaceContainerLow,
            borderRight: `1px solid ${md3?.outlineVariant}`,
          },
        }}
      >
        <DrawerContent onNavClick={handleNavClick} />
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          bgcolor: md3?.surface,
        }}
      >
        {/* Spacer for mobile AppBar */}
        <Box sx={{ display: { xs: "block", md: "none" }, height: 64 }} />

        <Box
          className="page-content"
          sx={{
            flex: 1,
            px: { xs: 2, sm: 3, md: 4 },
            py: { xs: 2, md: 3 },
            maxWidth: 1440,
            width: "100%",
            mx: "auto",
          }}
        >
          {children}
        </Box>

        <Box
          component="footer"
          sx={{
            py: 2,
            px: 3,
            textAlign: "center",
            borderTop: `1px solid ${md3?.outlineVariant}`,
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: md3?.outline }}
          >
            © {new Date().getFullYear()} MotdTracker
          </Typography>
        </Box>
      </Box>
    </Box>
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
