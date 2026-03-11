'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Snackbar,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://13.233.40.235';

const TenantForm = ({ tenant, onChange, disabledFields = [], title }) => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
      <TextField
        label="Name"
        value={tenant.name}
        onChange={(e) => onChange({ ...tenant, name: e.target.value })}
        required
        disabled={disabledFields.includes('name')}
      />
      <TextField
        label="Description"
        value={tenant.description}
        onChange={(e) => onChange({ ...tenant, description: e.target.value })}
      />
      <TextField
        label="Email"
        type="email"
        value={tenant.contactEmail}
        onChange={(e) => onChange({ ...tenant, contactEmail: e.target.value })}
        required
        disabled={disabledFields.includes('contactEmail')}
      />
      <TextField
        label="Phone"
        value={tenant.contactPhone}
        onChange={(e) => onChange({ ...tenant, contactPhone: e.target.value })}
      />
      <FormControlLabel
        control={
          <Switch
            checked={tenant.active}
            onChange={(e) => onChange({ ...tenant, active: e.target.checked })}
          />
        }
        label="Active"
      />
    </Box>
  );
};

export default function Tenants() {
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [totalItems, setTotalItems] = useState(0);

  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [newTenant, setNewTenant] = useState({
    name: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
    active: true,
  });

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const fetchTenants = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${API_BASE_URL}/votebase/v1/api/tenant?page=${page}&size=${pageSize}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to fetch tenants');
      const data = await response.json();
      setTenants(data.content || []);
      setTotalItems(data.totalElements || data.totalPages * pageSize);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, token]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleAddTenant = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/votebase/v1/api/tenant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newTenant),
      });
      if (!response.ok) throw new Error('Failed to create tenant');
      setSnackbar({ open: true, message: 'Tenant created successfully', severity: 'success' });
      setOpenAddDialog(false);
      setNewTenant({ name: '', description: '', contactEmail: '', contactPhone: '', active: true });
      fetchTenants();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleUpdateTenant = async () => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/votebase/v1/api/tenant/${selectedTenant.tenantId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(selectedTenant),
        }
      );
      if (!response.ok) throw new Error('Failed to update tenant');
      setSnackbar({ open: true, message: 'Tenant updated successfully', severity: 'success' });
      setOpenEditDialog(false);
      fetchTenants();
    } catch (err) {
      setSnackbar({ open: true, message: err.message, severity: 'error' });
    }
  };

  const handleEditClick = (tenant) => {
    setSelectedTenant({ ...tenant });
    setOpenEditDialog(true);
  };

  const columns = [
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'description', headerName: 'Description', flex: 1.5 },
    { field: 'contactEmail', headerName: 'Email', flex: 1.2 },
    { field: 'contactPhone', headerName: 'Phone', flex: 1 },
    {
      field: 'active',
      headerName: 'Active',
      width: 120,
      renderCell: (params) => <Switch checked={params.value} disabled size="small" />,
    },
    {
      field: 'actions',
      headerName: 'Actions',
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4">Tenant Management</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenAddDialog(true)}>
            Add Tenant
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <Box sx={{ height: 520, width: '100%' }}>
            <DataGrid
              rows={tenants}
              columns={columns}
              getRowId={(row) => row.tenantId}
              paginationMode="server"
              page={page}
              pageSize={pageSize}
              onPageChange={(newPage) => setPage(newPage)}
              onPageSizeChange={(newSize) => setPageSize(newSize)}
              rowCount={totalItems}
            />
          </Box>
        )}

        {/* Add Tenant Dialog */}
        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)}>
          <DialogTitle>Add New Tenant</DialogTitle>
          <DialogContent>
            <TenantForm tenant={newTenant} onChange={setNewTenant} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenAddDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleAddTenant}>
              Save
            </Button>
          </DialogActions>
        </Dialog>

        {/* Edit Tenant Dialog */}
        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
          <DialogTitle>Edit Tenant</DialogTitle>
          <DialogContent>
            <TenantForm
              tenant={selectedTenant || {}}
              onChange={setSelectedTenant}
              disabledFields={['contactEmail']}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleUpdateTenant}>
              Update
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar for success/error */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          message={snackbar.message}
        />
      </Box>
  );
}
