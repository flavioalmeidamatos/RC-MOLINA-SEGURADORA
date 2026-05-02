def main():
    try:
        with open('src/components/dashboard/rc_menu_principal.tsx', 'r', encoding='utf-8') as f:
            lines = f.readlines()

        new_lines = []
        skip = False
        i = 0
        while i < len(lines):
            line = lines[i]

            # 1. replace import (line 24)
            if 'import type { SistemaQuerLeadData } from "./sistema_quer_import_modal";' in line:
                new_lines.append('import { SistemaQuerImportModal, type SistemaQuerLeadData } from "./sistema_quer_import_modal";\n')
                i += 1
                continue

            # 2. remove importLoading state
            if 'const [importLoading, setImportLoading] = useState(false);' in line:
                i += 1
                continue

            # 3. remove importResult state
            if 'const [importResult, setImportResult] = useState<any>(null);' in line:
                i += 1
                continue

            # 4. remove handleImportLead
            if 'const handleImportLead = async (e: React.FormEvent) => {' in line:
                skip = True
                i += 1
                continue

            if skip:
                if line.startswith('  };'):
                    skip = False
                i += 1
                continue

            # 5. replace modal block
            if '      {showImportModal ? (' in line and not skip:
                # We know the block ends at line 994 but let's just count until the closing tag we expect
                # Or just skip 194 lines since we checked the exact lines
                # Wait, better to replace from '      {showImportModal ? (' until '      ) : null}' at the same indentation level
                pass
                
            new_lines.append(line)
            i += 1

        # Because skipping the modal block by indentation could be tricky, let's just delete by line numbers
        # Re-read to guarantee line numbers
        with open('src/components/dashboard/rc_menu_principal.tsx', 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Line numbers (0-indexed):
        # 23: import type { SistemaQuerLeadData } from "./sistema_quer_import_modal";
        # 64: const [importLoading, setImportLoading] = useState(false);
        # 81: const [importResult, setImportResult] = useState<any>(null);
        # 310 to 343: handleImportLead
        # 800 to 993: {showImportModal ? ( ... ) : null}

        # Apply exact logic:
        res = []
        for idx, line in enumerate(lines):
            if idx == 23:
                res.append('import { SistemaQuerImportModal, type SistemaQuerLeadData } from "./sistema_quer_import_modal";\n')
                continue
            if idx == 64:
                continue
            if idx == 81:
                continue
            if 310 <= idx <= 343:
                continue
            if idx == 800:
                new_modal_block = """      <SistemaQuerImportModal
        open={showImportModal}
        initialLeadUrl={credential.leadUrl}
        onClose={() => {
          setShowImportModal(false);
        }}
        onUseLeadData={(data) => {
          setPendingImportedLead(data);
          setActiveMenu("Meus clientes");
          setShowImportModal(false);
        }}
      />\n"""
                res.append(new_modal_block)
                continue
            if 801 <= idx <= 993:
                continue

            res.append(line)

        with open('src/components/dashboard/rc_menu_principal.tsx', 'w', encoding='utf-8') as f:
            f.write("".join(res))

        print("File updated successfully using line indices")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    main()
