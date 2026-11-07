CREATE UNIQUE INDEX IF NOT EXISTS idx_emp_email_unique
  ON employees (lower(email))
  WHERE deleted_at IS NULL AND email IS NOT NULL;
