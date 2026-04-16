const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function normalizeOptionalUuid(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const v = value.trim();
  if (!v) return null;
  return isUuid(v) ? v : undefined;
}

export type PrincipalFeeConfigInput = {
  class_fee_id?: string | null;
  class_fee_discount?: number;
  transport_enabled?: boolean;
  transport_route_id?: string | null;
  transport_fee_discount?: number;
  other_fees?: Array<{
    fee_category_id: string;
    enabled?: boolean;
    discount?: number;
  }>;
  custom_fees?: Array<{
    custom_fee_id: string;
    discount?: number;
    is_exempt?: boolean;
  }>;
};

/**
 * Produces a backend-safe `fee_config` object for principal student create (`POST /principal-users/students`).
 *
 * Backend Joi (`feeConfigSchema`) allows:
 * - `transport_route_id`: valid UUID, null, or omitted
 * - empty string `""` is NOT allowed for UUID fields
 */
export function sanitizePrincipalStudentCreateFeeConfig(input: PrincipalFeeConfigInput): PrincipalFeeConfigInput {
  const transport_enabled = input.transport_enabled ?? true;

  const out: PrincipalFeeConfigInput = {
    class_fee_discount: input.class_fee_discount ?? 0,
    transport_enabled,
    transport_fee_discount: input.transport_fee_discount ?? 0,
    other_fees: (input.other_fees ?? []).map((f) => ({
      fee_category_id: f.fee_category_id,
      enabled: f.enabled ?? true,
      discount: f.discount ?? 0
    })),
    custom_fees: (input.custom_fees ?? []).map((f) => ({
      custom_fee_id: f.custom_fee_id,
      discount: f.discount ?? 0,
      is_exempt: f.is_exempt ?? false
    }))
  };

  const classFeeId = normalizeOptionalUuid(input.class_fee_id);
  if (classFeeId) out.class_fee_id = classFeeId;

  if (!transport_enabled) {
    // Omit transport_route_id entirely when disabled
    return out;
  }

  const route = normalizeOptionalUuid(input.transport_route_id);
  if (route) {
    out.transport_route_id = route;
    return out;
  }

  // Transport enabled but no valid route: omit field (do not send "")
  return out;
}

export type PrincipalStudentAdminFeeConfigInput = PrincipalFeeConfigInput & {
  effective_from_date?: string;
};

/**
 * Produces a backend-safe `fee_config` for `PUT /students-admin/:studentId`.
 * Keeps `effective_from_date` (used by versioning logic) while normalizing UUID-ish fields.
 */
export function sanitizePrincipalStudentAdminFeeConfig(input: PrincipalStudentAdminFeeConfigInput): PrincipalStudentAdminFeeConfigInput {
  const base = sanitizePrincipalStudentCreateFeeConfig(input);
  const out: PrincipalStudentAdminFeeConfigInput = { ...base };

  const eff = (input.effective_from_date ?? '').trim();
  if (eff) out.effective_from_date = eff;

  return out;
}
