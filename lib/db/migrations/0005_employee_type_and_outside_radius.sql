ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_type VARCHAR(30) DEFAULT 'outlet';
ALTER TABLE employees ADD COLUMN IF NOT EXISTS can_clock_outside_radius BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_emp_type ON employees(employee_type) WHERE deleted_at IS NULL;
