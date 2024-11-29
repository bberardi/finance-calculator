import { Stack, Typography } from "@mui/material";

export const Header = () => {
  return (
    <div className="header">
      <Stack spacing={2}>
        <Typography variant="h2">PathWise</Typography>
        <Typography variant="h5">Your financial calculator and forecastor</Typography>
      </Stack>
    </div>
  );
};
