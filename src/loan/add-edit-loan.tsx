import {
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { emptyLoan, Loan } from '../models/loan-model';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { getMonthlyPayment, getTerms } from '../helpers/loan-helpers';
import { NumericFormat } from 'react-number-format';
import { ResponsiveDialog } from '../components/responsive-dialog';

export const AddEditLoan = (props: AddEditLoanProps) => {
  const [newLoan, setNewLoan] = useState<Loan>(emptyLoan);

  const isFormValid = () => {
    return (
      newLoan.Name.trim() !== '' &&
      newLoan.Provider.trim() !== '' &&
      newLoan.Principal > 0 &&
      newLoan.CurrentAmount > 0 &&
      newLoan.InterestRate > 0 &&
      newLoan.StartDate &&
      newLoan.EndDate &&
      newLoan.StartDate < newLoan.EndDate
    );
  };

  const onSave = () => {
    if (!isFormValid()) {
      return;
    }
    props.onSave(newLoan, props.loan);
    props.onClose();
    setNewLoan(emptyLoan);
  };

  useEffect(() => {
    setNewLoan(props.loan ?? emptyLoan);
  }, [props.loan]);

  useEffect(() => {
    if (
      newLoan.Principal &&
      newLoan.InterestRate &&
      newLoan.StartDate &&
      newLoan.EndDate
    ) {
      setNewLoan({
        ...newLoan,
        MonthlyPayment: getMonthlyPayment(
          newLoan.Principal,
          newLoan.InterestRate,
          getTerms(newLoan)
        ),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    newLoan.Principal,
    newLoan.InterestRate,
    newLoan.StartDate,
    newLoan.EndDate,
  ]);

  return (
    <ResponsiveDialog open={props.open} onClose={props.onClose}>
      <DialogTitle sx={{ textAlign: 'center' }}>
        {!props.loan ? 'Add new loan' : 'Edit loan'}
      </DialogTitle>
      <DialogContent>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            mt: 1,
          }}
        >
          <TextField
            label="Name"
            value={newLoan.Name}
            onChange={(e) => setNewLoan({ ...newLoan, Name: e.target.value })}
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
          <NumericFormat
            label="Principal"
            value={newLoan.Principal}
            thousandSeparator
            decimalScale={2}
            prefix={'$'}
            customInput={TextField}
            onValueChange={(vs) => {
              setNewLoan({ ...newLoan, Principal: Number(vs.value) });
            }}
            required
          />
          <NumericFormat
            label="Current Amount"
            value={newLoan.CurrentAmount}
            thousandSeparator
            decimalScale={2}
            prefix={'$'}
            customInput={TextField}
            onValueChange={(vs) => {
              setNewLoan({ ...newLoan, CurrentAmount: Number(vs.value) });
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
            views={['year', 'month', 'day']}
            openTo="day"
          />
          <Stack direction="row" spacing={1}>
            <DatePicker
              label="End Date"
              value={dayjs(newLoan.EndDate)}
              onChange={(date) =>
                setNewLoan({
                  ...newLoan,
                  EndDate: date?.toDate() ?? new Date(),
                })
              }
              views={['year', 'month', 'day']}
              openTo="year"
              sx={{ flex: 5 }}
            />
            <TextField
              label="Terms"
              value={getTerms(newLoan)}
              onChange={(e) =>
                setNewLoan({
                  ...newLoan,
                  EndDate: dayjs(newLoan.StartDate)
                    .add(Number(e.target.value) - 1, 'months')
                    .toDate(),
                })
              }
              sx={{ flex: 2 }}
            />
          </Stack>
          <Stack>
            <Typography gutterBottom>Interest Percentage</Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{
                alignItems: 'center',
              }}
            >
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
                max={30}
                sx={{ flex: 5 }}
              />
              <NumericFormat
                label="Interest Rate"
                value={newLoan.InterestRate}
                thousandSeparator
                decimalScale={3}
                suffix={'%'}
                customInput={TextField}
                onValueChange={(vs) => {
                  setNewLoan({
                    ...newLoan,
                    InterestRate: Number(vs.value),
                  });
                }}
                sx={{ flex: 2 }}
                required
              />
            </Stack>
          </Stack>

          <Stack direction="row">
            <NumericFormat
              label="Monthly Payment"
              value={newLoan.MonthlyPayment}
              thousandSeparator
              decimalScale={2}
              prefix={'$'}
              customInput={TextField}
              onValueChange={(vs) => {
                setNewLoan({ ...newLoan, MonthlyPayment: Number(vs.value) });
              }}
              sx={{ flex: 6 }}
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
              sx={{ flex: 1 }}
            >
              Reset
            </Button>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button type="reset" color="secondary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          onClick={onSave}
          disabled={!isFormValid()}
        >
          {!props.loan ? 'Add loan' : 'Save loan'}
        </Button>
      </DialogActions>
    </ResponsiveDialog>
  );
};

export interface AddEditLoanProps {
  open: boolean;
  onSave: (newLoan: Loan, oldLoan?: Loan) => void;
  onClose: () => void;
  loan?: Loan;
}
