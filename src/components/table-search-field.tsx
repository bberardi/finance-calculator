import { InputAdornment, TextField } from '@mui/material';
import { Search } from '@mui/icons-material';

// Shared search box for the loan/investment tables (roadmap 6.4). Controlled by
// the table, which owns the query string and applies it via filterBySearch.
export interface TableSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  // Accessible label, e.g. "Search loans".
  label: string;
}

export const TableSearchField = ({
  value,
  onChange,
  label,
}: TableSearchFieldProps) => (
  <TextField
    value={value}
    onChange={(e) => onChange(e.target.value)}
    size="small"
    label={label}
    placeholder="Name or provider"
    slotProps={{
      input: {
        startAdornment: (
          <InputAdornment position="start">
            <Search fontSize="small" />
          </InputAdornment>
        ),
      },
    }}
    sx={{ mb: 1.5, width: '100%', maxWidth: 360 }}
  />
);
