$sql = @"
UPDATE "RCMOLINASEGUROS"."CLIENTES"
SET como_conheceu = '6 - Lead'
WHERE nome_completo ILIKE '%- REMALHO%'
   OR observacoes_extras ILIKE '%- REMALHO%'
   OR documentacao_anotacoes ILIKE '%- REMALHO%';
"@

$sql | ssh -i $env:USERPROFILE\.ssh\rc_molina_vps root@187.77.55.45 "sudo -u postgres psql -d rcmolina"
