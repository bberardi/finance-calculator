import { useCallback, useState } from 'react';
import { ValidationResult } from './validation-helpers';

// Shared form-field reveal/tracking for the add/edit forms (roadmap 0.8).
//
// The loan and investment forms both need the same "don't open all-red"
// behavior: a field's error/warning is shown only once the user has touched it
// OR a save has been attempted, plus an always-visible explanation of why Save
// is disabled. That logic was duplicated byte-for-byte in both forms; it lives
// here so the two forms can't drift.
//
// It is generic over the form's field-key union and consumes the pure
// `ValidationResult` produced by validation-helpers — this hook owns only the
// touched/submit-attempted UI state, never the validation rules themselves.
export interface FieldTracking<TField extends string> {
  // Whether a field's messages should currently be revealed.
  showFor: (field: TField) => boolean;
  // Mark a field as touched (typically onBlur / onChange).
  touch: (field: TField) => void;
  // The field's error message, but only once it should be revealed.
  errorFor: (field: TField) => string | undefined;
  // The field's warning message, but only once it should be revealed.
  warningFor: (field: TField) => string | undefined;
  // Reset touched + submit-attempted (on open/cancel/successful save).
  resetTracking: () => void;
  // Flag a blocked save attempt so every field's error reveals at once.
  markSubmitAttempted: () => void;
  // Why Save is disabled: the revealed errors joined, or a neutral prompt.
  saveDisabledReason: string;
}

export const useFieldTracking = <TField extends string>(
  validation: ValidationResult<TField>
): FieldTracking<TField> => {
  const [touched, setTouched] = useState<Partial<Record<TField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const showFor = (field: TField) => submitAttempted || Boolean(touched[field]);
  const touch = (field: TField) =>
    setTouched((prev) => ({ ...prev, [field]: true }));
  const errorFor = (field: TField) =>
    showFor(field) ? validation.errors[field] : undefined;
  const warningFor = (field: TField) =>
    showFor(field) ? validation.warnings[field] : undefined;

  // Stable so the forms can safely list it in effect dependency arrays.
  const resetTracking = useCallback(() => {
    setTouched({});
    setSubmitAttempted(false);
  }, []);
  const markSubmitAttempted = useCallback(() => setSubmitAttempted(true), []);

  // Why Save is disabled, always visible while invalid: list the specific
  // revealed errors once fields are touched / a save was attempted, otherwise a
  // neutral prompt so the form doesn't open all-red.
  const revealedErrors = (Object.keys(validation.errors) as TField[])
    .filter((field) => showFor(field))
    .map((field) => validation.errors[field])
    .filter((message): message is string => Boolean(message));
  const saveDisabledReason =
    revealedErrors.length > 0
      ? revealedErrors.join(' ')
      : 'Fill in all required fields to enable saving.';

  return {
    showFor,
    touch,
    errorFor,
    warningFor,
    resetTracking,
    markSubmitAttempted,
    saveDisabledReason,
  };
};
