$sql = @"
UPDATE "RCMOLINASEGUROS"."CLIENTES"
SET como_conheceu = '6 - Lead'
WHERE como_conheceu = '6 - Leads';
"@

$sql | ssh -i $env:USERPROFILE\.ssh\rc_molina_vps root@187.77.55.45 "sudo -u postgres psql -d rcmolina"
