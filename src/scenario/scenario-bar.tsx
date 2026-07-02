import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Scenario } from '../models/scenario-model';
import { useFinanceData } from '../state/use-finance-data';
import { investmentsFromAssets } from '../helpers/asset-investment-helpers';
import { ConfirmDeleteDialog } from '../components/confirm-delete-dialog';
import { ScenarioBuilderDialog } from './scenario-builder-dialog';

// Matches the entity-delete undo window in Body.
const DELETE_UNDO_DURATION_MS = 6000;

// Scenario controls in the forecast section (Phase 4.2). Create a scenario,
// switch the active overlay between "Baseline" and any saved scenario, and
// delete scenarios. The active selection drives the chart overlay (4.3).
export const ScenarioBar = () => {
  const {
    state: { loans, assets, scenarios, activeScenarioId },
    addScenario,
    setActiveScenario,
    deleteScenario,
  } = useFinanceData();

  // Investments are folded into assets; derive the Investment[] the scenario
  // builder needs from the investment-type assets.
  const investments = useMemo(() => investmentsFromAssets(assets), [assets]);

  const [builderOpen, setBuilderOpen] = useState(false);

  // Deleting a scenario gets the same confirm + soft-undo treatment as every
  // other delete in the app (roadmap 0.7): a hand-tuned split is real work, and
  // the chip's small "×" is easy to hit by accident. Undo restores the scenario
  // with its Id intact (addScenario keeps a provided Id) and re-activates it if
  // it was the active overlay.
  const [pendingDelete, setPendingDelete] = useState<Scenario>();
  const [undoableDelete, setUndoableDelete] = useState<{
    scenario: Scenario;
    wasActive: boolean;
  }>();

  const onConfirmDelete = () => {
    if (!pendingDelete) {
      return;
    }
    setUndoableDelete({
      scenario: pendingDelete,
      wasActive: pendingDelete.Id === activeScenarioId,
    });
    deleteScenario(pendingDelete.Id);
    setPendingDelete(undefined);
  };

  const onUndoDelete = () => {
    if (!undoableDelete) {
      return;
    }
    const id = addScenario(undoableDelete.scenario);
    if (undoableDelete.wasActive) {
      setActiveScenario(id);
    }
    setUndoableDelete(undefined);
  };

  const handleSave = (scenario: Scenario) => {
    const id = addScenario(scenario);
    setActiveScenario(id);
  };

  return (
    <Box sx={{ marginBottom: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ flexWrap: 'wrap', alignItems: 'center' }}
      >
        <Typography variant="body2" color="text.secondary">
          Scenarios:
        </Typography>

        <Chip
          label="Baseline"
          color={activeScenarioId === null ? 'primary' : 'default'}
          variant={activeScenarioId === null ? 'filled' : 'outlined'}
          onClick={() => setActiveScenario(null)}
        />

        {scenarios.map((scenario) => {
          const active = scenario.Id === activeScenarioId;
          return (
            <Chip
              key={scenario.Id}
              label={scenario.Name}
              color={active ? 'primary' : 'default'}
              variant={active ? 'filled' : 'outlined'}
              onClick={() => setActiveScenario(active ? null : scenario.Id)}
              onDelete={() => setPendingDelete(scenario)}
            />
          );
        })}

        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setBuilderOpen(true)}
        >
          New scenario
        </Button>
      </Stack>

      <ScenarioBuilderDialog
        open={builderOpen}
        loans={loans}
        investments={investments}
        onSave={handleSave}
        onClose={() => setBuilderOpen(false)}
      />

      <ConfirmDeleteDialog
        itemName={pendingDelete?.Name}
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={onConfirmDelete}
      />

      {/* Soft-undo, matching Body's entity-delete snackbar conventions. */}
      <Snackbar
        open={!!undoableDelete}
        autoHideDuration={DELETE_UNDO_DURATION_MS}
        onClose={() => setUndoableDelete(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity="info"
          sx={{ width: '100%' }}
          action={
            <Button color="inherit" size="small" onClick={onUndoDelete}>
              UNDO
            </Button>
          }
        >
          {`Deleted ${undoableDelete?.scenario.Name ?? ''}`}
        </Alert>
      </Snackbar>
    </Box>
  );
};
