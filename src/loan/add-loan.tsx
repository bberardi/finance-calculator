import { Box, Button, Card, CardContent, Popover, Slider, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { emptyLoan, Loan } from "./loan-model";
import { DatePicker } from "@mui/x-date-pickers";
import dayjs from "dayjs";

export const AddLoan = (props: AddLoanProps) => {
    const [newLoan, setNewLoan] = useState<Loan>(emptyLoan);

    const onSave = () => {
        // Additional verification
        props.onSave(newLoan);
        setNewLoan(emptyLoan);
        props.onClose();
    }

    return (
      <Popover
        // id={"simple-popover"}
        open={props.open}
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
                label="Current Amount"
                type="number"
                value={newLoan.CurrentAmount}
                onChange={(e) =>
                  setNewLoan({
                    ...newLoan,
                    CurrentAmount: Number(e.target.value),
                  })
                }
                required
              />
              <TextField
                label="Initial Amount"
                type="number"
                value={newLoan.InitialAmount}
                onChange={(e) =>
                  setNewLoan({
                    ...newLoan,
                    InitialAmount: Number(e.target.value),
                  })
                }
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
                // renderInput={(params) => <TextField {...params} required />}
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
                // renderInput={(params) => <TextField {...params} required />}
              />
              <Typography gutterBottom>Interest Percentage</Typography>
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
                step={0.1}
                min={0}
                max={100}
              />
              <Button type="submit" variant="contained" color="primary" onClick={onSave}>
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