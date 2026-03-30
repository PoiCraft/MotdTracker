import { createContext, useContext } from "react";

export const ColorModeContext = createContext({
  mode: "light",
  toggleMode: () => {}
});

export function useColorMode() {
  return useContext(ColorModeContext);
}
