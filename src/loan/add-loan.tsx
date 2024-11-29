import { Box, Button, Card, CardContent, Popover, Slider, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { emptyLoan, Loan } from "../models/loan-model";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";
import { getMonthlyPayment, getTerms } from "../helpers/loan-helpers";

export const AddLoan = (props: AddLoanProps) => {
  const [newLoan, setNewLoan] = useState<Loan>(emptyLoan);

  const onSave = () => {
      // Additional verification
      props.onSave(newLoan);
      setNewLoan(emptyLoan);
      props.onClose();
  }

  useEffect(() => {
    if(newLoan.Principal && newLoan.InterestRate && newLoan.StartDate && newLoan.EndDate) {
      setNewLoan({
        ...newLoan,
        MonthlyPayment: getMonthlyPayment(newLoan.Principal, newLoan.InterestRate, getTerms(newLoan))
      })
    } 
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newLoan.Principal, newLoan.InterestRate, newLoan.StartDate, newLoan.EndDate])

  

  return (
    <Popover
      open={props.open}
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
            Add New Loan
          </Typography>
          <Box display="flex" flexDirection="column" gap={2}>
            <TextField
              label="Name"
              value={newLoan.Name}
              onChange={(e) =>
                setNewLoan({ ...newLoan, Name: e.target.value })
              }
              required
            />
            <TextField
              label="Loan Provider"
              value={newLoan.Provider}
              onChange={(e) =>
                setNewLoan({ ...newLoan, Provider: e.target.value })
              }
              required
            />
            <TextField
              label="Principal"
              type="number"
              value={newLoan.Principal}
              onChange={(e) =>
                setNewLoan({
                  ...newLoan,
                  Principal: Number(e.target.value)
                })
              }
              InputProps={{
                startAdornment: "$",
              }}
              required
            />
            <TextField
              label="Current Amount"
              type="number"
              value={newLoan.CurrentAmount}
              onChange={(e) =>
                setNewLoan({
                  ...newLoan,
                  CurrentAmount: Number(e.target.value),
                })
              }
              InputProps={{
                startAdornment: "$",
              }}
              required
            />
            <DatePicker
              label="Start Date"
              value={dayjs(newLoan.StartDate)}
              onChange={(date) =>
                setNewLoan({
                  ...newLoan,
                  StartDate: date?.toDate() ?? new Date(),
                })
              }
            />
            <DatePicker
              label="End Date"
              value={dayjs(newLoan.EndDate)}
              onChange={(date) =>
                setNewLoan({
                  ...newLoan,
                  EndDate: date?.toDate() ?? new Date(),
                })
              }
            />
            <Stack>
              <Typography gutterBottom>Interest Percentage</Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Slider
                  value={newLoan.InterestRate}
                  onChange={(_e, newValue) =>
                    setNewLoan({
                      ...newLoan,
                      InterestRate: Array.isArray(newValue)
                        ? newValue[0]
                        : newValue,
                    })
                  }
                  valueLabelDisplay="auto"
                  step={0.25}
                  min={0}
                  max={40}
                />
                <TextField
                  label="Interest Rate"
                  type="number"
                  value={newLoan.InterestRate}
                  onChange={(e) =>
                    setNewLoan({
                      ...newLoan,
                      InterestRate: Number(e.target.value),
                    })
                  }
                  InputProps={{
                    endAdornment: "%",
                  }}
                  required
                />
              </Stack>
            </Stack>

            <Stack direction="row">
              <TextField
                label="Monthly Payment"
                type="number"
                value={newLoan.MonthlyPayment}
                onChange={(e) =>
                  setNewLoan({
                    ...newLoan,
                    MonthlyPayment: Number(e.target.value),
                  })
                }
                InputProps={{
                  endAdornment: "$ / month",
                }}
                required
              />
              <Button
                onClick={() =>
                  setNewLoan({
                    ...newLoan,
                    MonthlyPayment: getMonthlyPayment(
                      newLoan.Principal,
                      newLoan.InterestRate,
                      getTerms(newLoan)
                    ),
                  })
                }
              >
                Reset
              </Button>
            </Stack>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              onClick={onSave}
            >
              Add Loan
            </Button>
          </Box>
        </CardContent>
      </Card>
      {/* <Typography sx={{ p: 2 }}>The content of the Popover.</Typography>
      <TextField id="outlined-basic" value={newLoan.Name} onChange={v => setNewLoan({...newLoan, Name:v.target.value})}/> */}
      {/* <Button onClick={onSave}>Add loan</Button> */}
    </Popover>
  );
}

export interface AddLoanProps {
    open: boolean;
    onSave: (newLoan: Loan) => void;
    onClose: () => void;
}