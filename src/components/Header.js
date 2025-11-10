import React from "react";
import { AppBar, Toolbar, Typography, Box } from "@mui/material";
import LogoutButton from "../pages/LogoutButton";

const Header = () => {
  return (
    <AppBar position="static" color="primary">
      <Toolbar sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="h6">Admin Dashboard</Typography>

        {/* Profile + Logout section */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="body1">
            {localStorage.getItem("userName")}
          </Typography>
          <LogoutButton />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;