import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const page = readFileSync(resolve('src/pages/dashboard/busca-leads/page.tsx'), 'utf8');
const modal = readFileSync(resolve('src/components/feature/CsvImportModal.tsx'), 'utf8');

describe('Busca de Leads CSV entry', () => {
  it('uses the page-owned native file picker only after preloaded create access is allowed', () => {
    expect(page).toContain('const csvFileRef = useRef<HTMLInputElement>(null);');
    expect(page).toContain("csvImportAccess !== 'allowed'");
    expect(page).toContain('csvFileRef.current?.click()');
    expect(page).toContain('ref={csvFileRef}');
    expect(page).toContain('onChange={onCsvFileChange}');
  });

  it('keeps the modal parser reusable while delegating file replacement back to Busca de Leads', () => {
    expect(modal).toContain('selectedFile?: File | null;');
    expect(modal).toContain('selectionRevision?: number;');
    expect(modal).toContain('onRequestFile?: () => void;');
    expect(modal).toContain('onRequestFile?.()');
    expect(modal).toContain('fileRef.current?.click()');
  });

  it('keeps the pending original batch visible instead of parsing a stale external file', () => {
    expect(modal).toContain('if (confirmarLotePendente || !selectedFile || selectionRevision <= 0');
    expect(modal).toContain('[aoSelecionar, confirmarLotePendente, selectedFile, selectionRevision]');
  });

  it('derives CSV create access from the active organization session and clears a previous selection on organization change', () => {
    expect(page).toContain("import { useCurrentAccess } from '@/hooks/useCurrentAccess';");
    expect(page).toContain('const { access: csvCurrentAccess, loading: csvAccessLoading } = useCurrentAccess();');
    expect(page).toContain('csvCurrentAccess?.permissions[\'leads.create\'] === true');
    expect(page).toContain('setCsvSelectedFile(null);');
    expect(page).toContain('setCsvModal(false);');
  });

  it('only exposes the imported-lead navigation after a refreshed confirmed result', () => {
    expect(modal).toContain('!resultado.refreshPending && resultado.listId && onAbrirLeadsImportados');
    expect(page).toContain('importedLeadListHref(result.listId)');
  });
});
