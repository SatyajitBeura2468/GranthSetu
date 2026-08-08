# Settings and policy guide

GranthSetu does not hardcode school policy. An administrator must configure loan period, checkout limit, renewal limit, and—when used—fine grace period and daily INR rate. Fines can be disabled explicitly.

If required values are absent or invalid, circulation fails safely with an operator-facing setup message. Values are stored as typed integer, boolean, or INR minor-unit settings and are written only through `admin_upsert_setting`.
