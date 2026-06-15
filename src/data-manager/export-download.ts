import { Loan } from '../models/loan-model';
import { Investment } from '../models/investment-model';
import { exportToJson } from '../helpers/data-helpers';

// Side-effecting export: serialize inputs (pure, in data-helpers) and trigger a
// browser download. Shared by the DataManager command and the global error
// boundary's "export my data" escape hatch (1.4) so the download behavior can't
// drift between them. Throws on failure; callers surface their own feedback.
export const downloadJsonExport = (
  loans: Loan[],
  investments: Investment[]
): void => {
  const jsonData = exportToJson(loans, investments);
  const blob = new Blob([jsonData], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pathwise-data-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
