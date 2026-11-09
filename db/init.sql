CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY,
  selected_bet TEXT NOT NULL
    CHECK (selected_bet IN ('red', 'black')),
  stake_credits INTEGER NOT NULL
    CHECK (stake_credits BETWEEN 1 AND 1000),
  result_number INTEGER NOT NULL
    CHECK (result_number BETWEEN 0 AND 36),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
