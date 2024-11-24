import { Box, Card, CardContent, Popover, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { defaultPit, Loan, PitLoan } from "./loan-model";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { getPitCalculation } from "../helpers/loan-helpers";

export const PitPopout = (props: PitPopoutProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [pitLoan, setPitLoan] = useState<PitLoan>(defaultPit);

  useEffect(() => {
    if(props.loan){
      setPitLoan(getPitCalculation(props.loan, selectedDate));
    }
  }, [props.loan, selectedDate]);

  return (
    <Popover
      open={!!props.loan}
      onClose={props.onClose}
      anchorOrigin={{
        vertical: "center",
        horizontal: "center",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "center",
      }}
    >
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Point-in-Time Calculator
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <DatePicker
              label="Start Date"
              value={dayjs(selectedDate)}
              onChange={(date) => setSelectedDate(date?.toDate() ?? new Date())}
            />
            <Typography>{`Paid Terms: ${pitLoan.PaidTerms}`}</Typography>
            <Typography>{`Remaining Terms: ${pitLoan.RemainingTerms}`}</Typography>
            <Typography>{`Paid Principal: ${pitLoan.PaidPrincipal}`}</Typography>
            <Typography>{`Remaining Principal: ${pitLoan.RemainingPrincipal}`}</Typography>
          </Box>
        </CardContent>
      </Card>
    </Popover>
  );
}

export interface PitPopoutProps {
    loan?: Loan;
    onClose: () => void;
}