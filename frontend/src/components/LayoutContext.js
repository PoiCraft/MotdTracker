import { createContext, useContext } from "react";

export const LayoutContext = createContext({
  drawerWidth: 0,
  isMobile: false,
  isTablet: false,
  isDesktop: false,
});

export function useLayout() {
  return useContext(LayoutContext);
}
