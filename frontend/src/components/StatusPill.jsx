import { Chip } from "@mui/material";

export default function StatusPill({ online }) {
  return (
    <Chip
      size="small"
      className={online ? "status-pill online" : "status-pill offline"}
      label={online ? "在线" : "离线"}
      color={online ? "success" : "error"}
      variant={online ? "filled" : "outlined"}
    />
  );
}