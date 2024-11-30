import { Box, Card, CardContent, Popover, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { defaultPit, Loan, PitLoan } from "../models/loan-model";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { getPitCalculation, getTerms } from "../helpers/loan-helpers";
import { NumericFormat } from "react-number-format";

export const PitPopout = (props: PitPopoutProps) => {
  const [selectedDate, setSelectedDate] = useState<Date>(props.loan.EndDate);
  const [pitLoan, setPitLoan] = useState<PitLoan>(defaultPit);

  const handleTermsChange = (newTerms: number) =>{
    if(newTerms < 0){
      setSelectedDate(dayjs(props.loan.StartDate).toDate());
    }
    else if (newTerms > getTerms(props.loan)){
      setSelectedDate(dayjs(props.loan.EndDate).toDate());
    }
    else{
      setSelectedDate( dayjs(props.loan.StartDate)
      .add(newTerms - 1, "months")
      .toDate()
      );
    }
  }

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
        vertical: "center",
        horizontal: "center",
      }}
    >
      <Card>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Point-in-Time Calculator
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <Stack direction="row">
              <DatePicker
                label="Start Date"
                value={dayjs(selectedDate)}
                onChange={(date) =>
                  setSelectedDate(date?.toDate() ?? new Date())
                }
                minDate={dayjs(props.loan.StartDate).add(-1, "month")}
                maxDate={dayjs(props.loan.EndDate)}
                views={["year", "month"]}
                sx={{ flex: 4 }}
              />
              <NumericFormat
                label="Terms"
                value={getTerms(props.loan, selectedDate)}
                thousandSeparator
                decimalScale={0}
                customInput={TextField}
                onValueChange={(vs) => {
                  handleTermsChange(Number(vs.value));
                }}
                sx={{ flex: 2}}
              />
            </Stack>
            <Typography>{`Paid Terms: ${pitLoan.PaidTerms}`}</Typography>
            <Typography>{`Remaining Terms: ${pitLoan.RemainingTerms}`}</Typography>
            <Typography>{`Paid Principal: ${pitLoan.PaidPrincipal.toLocaleString(
              undefined,
              {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`}</Typography>
            <Typography>{`Remaining Principal: ${pitLoan.RemainingPrincipal.toLocaleString(
              undefined,
              {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`}</Typography>
          </Box>
        </CardContent>
      </Card>
    </Popover>
  );
}

export interface PitPopoutProps {
    loan: Loan;
    onClose: () => void;
}