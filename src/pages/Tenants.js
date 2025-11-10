import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";

const Tenants = () => {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(0);

  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);

  const [newTenant, setNewTenant] = useState({
    name: "",
    description: "",
    contactEmail: "",
    contactPhone: "",
    active: true,
  });

  const token = localStorage.getItem("token");

  // 🔹 Fetch tenants with pagination
  const fetchTenants = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_URL}/votebase/v1/api/tenant?page=${page}&size=${pageSize}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) throw new Error("Failed to fetch tenants");

      const data = await response.json();
      setTenants(data.content || []);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
    // eslint-disable-next-line
  }, [page, pageSize]);

  // ➕ Add Tenant
  const handleAddTenant = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_URL}/votebase/v1/api/tenant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(newTenant),
        }
      );
      if (!response.ok) throw new Error("Failed to create tenant");
      alert("✅ Tenant created successfully");
      setOpenAddDialog(false);
      setNewTenant({
        name: "",
        description: "",
        contactEmail: "",
        contactPhone: "",
        active: true,
      });
      fetchTenants();
    } catch (err) {
      alert(`❌ ${err.message}`);
    }
  };

  // ✏️ Update Tenant
  const handleUpdateTenant = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_BASE_URL}/votebase/v1/api/tenant/${selectedTenant.tenantId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(selectedTenant),
        }
      );

      if (!response.ok) throw new Error("Failed to update tenant");

      alert("✅ Tenant updated successfully");
      setOpenEditDialog(false);
      fetchTenants();
    } catch (err) {
      alert(`❌ ${err.message}`);
    }
  };

  // Open edit dialog
  const handleEditClick = (tenant) => {
    setSelectedTenant({ ...tenant });
    setOpenEditDialog(true);
  };

  // Table columns
  const columns = [
    { field: "name", headerName: "Name", flex: 1 },
    { field: "description", headerName: "Description", flex: 1.5 },
    { field: "contactEmail", headerName: "Email", flex: 1.2 },
    { field: "contactPhone", headerName: "Phone", flex: 1 },
    {
      field: "active",
      headerName: "Active",
      width: 120,
      renderCell: (params) => (
        <Switch checked={params.value} disabled size="small" />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 140,
      renderCell: (params) => (
        <Button
          variant="outlined"
          size="small"
          startIcon={<EditIcon />}
          onClick={() => handleEditClick(params.row)}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography variant="h4">Tenant Management</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setOpenAddDialog(true)}
        >
          Add Tenant
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 5 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error">{error}</Alert>
      ) : (
        <Box sx={{ height: 520, width: "100%" }}>
          <DataGrid
            rows={tenants}
            columns={columns}
            getRowId={(row) => row.id}
            paginationMode="server"
            pageSize={pageSize}
            onPageChange={(newPage) => setPage(newPage)}
            onPageSizeChange={(newSize) => setPageSize(newSize)}
            rowCount={totalPages * pageSize}
          />
        </Box>
      )}

      {/* ➕ Add Tenant Dialog */}
      <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
        <DialogTitle>Add New Tenant</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
        >
          <TextField
            label="Name"
            value={newTenant.name}
            onChange={(e) =>
              setNewTenant({ ...newTenant, name: e.target.value })
            }
            required
          />
          <TextField
            label="Description"
            value={newTenant.description}
            onChange={(e) =>
              setNewTenant({ ...newTenant, description: e.target.value })
            }
          />
          <TextField
            label="Email"
            type="email"
            value={newTenant.contactEmail}
            onChange={(e) =>
              setNewTenant({ ...newTenant, contactEmail: e.target.value })
            }
            required
          />
          <TextField
            label="Phone"
            value={newTenant.contactPhone}
            onChange={(e) =>
              setNewTenant({ ...newTenant, contactPhone: e.target.value })
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={newTenant.active}
                onChange={(e) =>
                  setNewTenant({ ...newTenant, active: e.target.checked })
                }
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleAddTenant}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* ✏️ Edit Tenant Dialog */}
      <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
        <DialogTitle>Edit Tenant</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
        >
          <TextField
            label="Name"
            value={selectedTenant?.name || ""}
            onChange={(e) =>
              setSelectedTenant({ ...selectedTenant, name: e.target.value })
            }
          />
          <TextField
            label="Description"
            value={selectedTenant?.description || ""}
            onChange={(e) =>
              setSelectedTenant({
                ...selectedTenant,
                description: e.target.value,
              })
            }
          />
          <TextField
            label="Email"
            value={selectedTenant?.contactEmail || ""}
            disabled
          />
          <TextField
            label="Phone"
            value={selectedTenant?.contactPhone || ""}
            onChange={(e) =>
              setSelectedTenant({
                ...selectedTenant,
                contactPhone: e.target.value,
              })
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={selectedTenant?.active || false}
                onChange={(e) =>
                  setSelectedTenant({
                    ...selectedTenant,
                    active: e.target.checked,
                  })
                }
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateTenant}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Tenants;