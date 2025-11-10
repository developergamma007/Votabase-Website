import React, { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Avatar,
  CircularProgress,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";

const LoginPage = () => {
  const [formData, setFormData] = useState({ userName: "", password: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_URL}/votebase/v1/api/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: formData.userName,
            password: formData.password,
          }),
        }
      );

      if (!response.ok) throw new Error("Invalid username or password");

      const data = await response.json();
      const result = data?.data?.result;

      if (!result?.token) throw new Error("Invalid response from server");

      localStorage.setItem("token", result.token);
      localStorage.setItem("role", result.role);
      localStorage.setItem("userName", result.userName);
      localStorage.setItem("tenantId", result.tenantId || "");

      alert("✅ Login successful!");

      if (result.role === "SUPER_ADMIN") navigate("/tenants");
      else if (result.role === "ADMIN") navigate("/dashboard");
      else navigate("/login");
    } catch (err) {
      alert(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "#f5f5f5",
      }}
    >
      <Paper
        elevation={6}
        sx={{ p: 4, width: 360, textAlign: "center", borderRadius: 3 }}
      >
        <Avatar sx={{ bgcolor: "primary.main", mb: 2, mx: "auto" }}>
          <LockOutlinedIcon />
        </Avatar>
        <Typography variant="h5" sx={{ mb: 2 }}>
          Admin Login
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            label="Username"
            name="userName"
            fullWidth
            margin="normal"
            value={formData.userName}
            onChange={handleChange}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            fullWidth
            margin="normal"
            value={formData.password}
            onChange={handleChange}
            required
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, py: 1 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : "Sign In"}
          </Button>
        </form>
      </Paper>
    </Box>
  );
};

export default LoginPage;