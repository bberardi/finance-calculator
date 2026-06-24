import { useMemo, useState } from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { Scenario } from '../models/scenario-model';
import { useFinanceData } from '../state/use-finance-data';
import { investmentsFromAssets } from '../helpers/asset-investment-helpers';
import { ScenarioBuilderDialog } from './scenario-builder-dialog';

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
              onDelete={() => deleteScenario(scenario.Id)}
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
    </Box>
  );
};
