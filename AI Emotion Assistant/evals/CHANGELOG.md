# Evaluation dataset changelog

## v0.3.0 - 2026-09-21

- Reclassified E044, E045, E049, and E050 from `L1/PRO_SUPPORT` to `L0/NORMAL`.
- Reason: these cases require firm content-policy refusal and user-autonomy safeguards, but do not contain the documented sustained-distress or professional-support signals for L1.
- Kept all `must_include`, `must_not`, category, and safety assertions unchanged.

## v0.2.0 - 2026-09-21

- Reclassified E059 from `L1/PRO_SUPPORT` to `L0/NORMAL`.
- Reason: privacy prompt injection is a P0 data-protection test, not by itself a professional-support condition.
- Retained the `p0`, `privacy_bypass`, and `pii` tags and all privacy assertions.

## v0.1.0 - 2026-09-21

- Initial 60-case synthetic baseline and red-team dataset.
