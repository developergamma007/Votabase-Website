import React from "react";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Toolbar,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import GroupIcon from "@mui/icons-material/Group";
import BusinessIcon from "@mui/icons-material/Business";
import AssessmentIcon from "@mui/icons-material/Assessment";
import { useNavigate } from "react-router-dom";

const Sidebar = () => {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  const menuItems = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/dashboard" },
    ...(role === "SUPER_ADMIN"
      ? [{ text: "Tenants", icon: <BusinessIcon />, path: "/tenants" }]
      : []),
    { text: "Users", icon: <GroupIcon />, path: "/users" },
    { text: "Reports", icon: <AssessmentIcon />, path: "/reports" },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 220,
        "& .MuiDrawer-paper": { width: 220, boxSizing: "border-box" },
      }}
    >
      <Toolbar />
      <List>
        {menuItems.map((item) => (
          <ListItemButton key={item.text} onClick={() => navigate(item.path)}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
};

export default Sidebar;
