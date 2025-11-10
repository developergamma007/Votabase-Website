import React from "react";
import { Button } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";

const LogoutButton = () => {
  const handleLogout = () => {
    // ✅ Clear all saved login info
    localStorage.clear();

    // ✅ Redirect to login
    window.location.href = "/login";
  };

  return (
    <Button
      color="error"
      variant="outlined"
      startIcon={<LogoutIcon />}
      onClick={handleLogout}
    >
      Logout
    </Button>
  );
};

export default LogoutButton;