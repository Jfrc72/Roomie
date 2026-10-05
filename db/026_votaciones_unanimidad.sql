-- Votaciones: además de mayoría simple, unanimidad de los integrantes habilitados.
ALTER TABLE polls DROP CONSTRAINT IF EXISTS polls_rule_check;
ALTER TABLE polls ADD CONSTRAINT polls_rule_check CHECK(rule IN ('simple','unanimous'));
