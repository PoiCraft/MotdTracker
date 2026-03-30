import { NavLink } from "react-router-dom";
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import MenuRoundedIcon from "@mui/icons-material/MenuRounded";
import HomeRoundedIcon from "@mui/icons-material/HomeRounded";
import DnsRoundedIcon from "@mui/icons-material/DnsRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import BadgeRoundedIcon from "@mui/icons-material/BadgeRounded";
import HubRoundedIcon from "@mui/icons-material/HubRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { alpha } from "@mui/material/styles";
import { useColorMode } from "../color-mode";

const navItems = [
  { to: "/server", label: "总览", icon: <HomeRoundedIcon fontSize="small" /> },
  { to: "/nodes", label: "节点", icon: <DnsRoundedIcon fontSize="small" /> },
  { to: "/players", label: "玩家", icon: <GroupsRoundedIcon fontSize="small" /> },
  { to: "/badges", label: "徽章", icon: <BadgeRoundedIcon fontSize="small" /> }
];

const drawerWidth = 280;

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { mode, toggleMode } = useColorMode();

  const currentTitle = useMemo(() => {
    const found = navItems.find((item) => location.pathname.startsWith(item.to));
    return found?.label || "MotdTracker";
  }, [location.pathname]);

  const drawerContent = (
    <Stack sx={{ height: "100%" }}>
      <Toolbar sx={{ px: 1, alignItems: "center", gap: 1 }}>
        <HubRoundedIcon color="primary" />
        <Box>
          <Typography variant="h6" fontWeight={700}>MotdTracker</Typography>
          <Typography variant="body2" color="text.secondary">Material You App</Typography>
        </Box>
        <Tooltip title={mode === "light" ? "切换到深色" : "切换到浅色"}>
          <IconButton sx={{ ml: "auto" }} onClick={toggleMode}>
            {mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
          </IconButton>
        </Tooltip>
      </Toolbar>
      <Divider />
      <List sx={{ p: 1.5, gap: 1, display: "grid" }}>
        {navItems.map((item) => (
          <ListItem key={item.to} disablePadding>
            <ListItemButton
              component={NavLink}
              to={item.to}
              onClick={() => setOpen(false)}
              sx={{
                borderRadius: 999,
                px: 2,
                gap: 1,
                "&.active": {
                  bgcolor: "primary.light",
                  color: "primary.dark"
                }
              }}
            >
              {item.icon}
              <ListItemText primary={item.label} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Box sx={{ mt: "auto", p: 2, color: "text.secondary" }}>
        <Typography variant="caption">前后端分离重构版</Typography>
      </Box>
    </Stack>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", backgroundColor: "background.default" }}>
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          display: { xs: "block", md: "none" },
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.92),
          backdropFilter: "blur(8px)"
        }}
      >
        <Toolbar>
          <IconButton edge="start" onClick={() => setOpen(true)}>
            <MenuRoundedIcon />
          </IconButton>
          <Typography variant="h6" sx={{ ml: 1 }}>{currentTitle}</Typography>
          <Tooltip title={mode === "light" ? "切换到深色" : "切换到浅色"}>
            <IconButton sx={{ ml: "auto" }} onClick={toggleMode}>
              {mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={open}
        onClose={() => setOpen(false)}
        sx={{
          display: { xs: "block", md: "none" },
          width: drawerWidth,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box"
          }
        }}
      >
        {drawerContent}
      </Drawer>

      <Drawer
        variant="permanent"
        open
        sx={{
          display: { xs: "none", md: "block" },
          width: drawerWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: drawerWidth,
            boxSizing: "border-box",
            borderRight: "1px solid",
            borderColor: "divider"
          }
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 1.5, md: 2.5 },
          pt: { xs: 10, md: 2.5 }
        }}
      >
        <main className="content">{children}</main>
      </Box>
    </Box>
  );
}