$sql = @"
SELECT DISTINCT como_conheceu FROM "RCMOLINASEGUROS"."CLIENTES";
"@

$sql | ssh -i $env:USERPROFILE\.ssh\rc_molina_vps root@187.77.55.45 "sudo -u postgres psql -d rcmolina"
