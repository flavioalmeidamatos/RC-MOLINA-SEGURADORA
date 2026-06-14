$sql = @"
UPDATE "RCMOLINASEGUROS"."CLIENTES"
SET company_id = 'ce5af695-ce0f-4cc0-a7e3-6dac3252cfdb',
    usuario_id = '136ac943-a624-410c-9cae-a9ecb279b6a2'
WHERE usuario_id IS NULL;

UPDATE "RCMOLINASEGUROS"."AGENDAMENTOS"
SET company_id = 'ce5af695-ce0f-4cc0-a7e3-6dac3252cfdb',
    usuario_id = '136ac943-a624-410c-9cae-a9ecb279b6a2'
WHERE usuario_id IS NULL;
"@

$sql | ssh -i $env:USERPROFILE\.ssh\rc_molina_vps root@187.77.55.45 "sudo -u postgres psql -d rcmolina"
