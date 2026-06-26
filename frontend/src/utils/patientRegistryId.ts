/** Bemorning pasport seriya raqami (doimiy ID — chek va qidiruv kaliti). */
export function formatPatientRegistryId(
  patient: { registry_number?: string | null; id?: number | null },
): string {
  if (patient.registry_number) {
    return patient.registry_number;
  }
  const n = patient.id;
  if (n != null && n > 0) {
    return String(n).padStart(8, '0');
  }
  return '';
}
