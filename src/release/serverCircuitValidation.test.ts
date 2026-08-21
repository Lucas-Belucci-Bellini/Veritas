import { describe, expect, it } from 'vitest'
import validationMigration from '../../supabase/migrations/20260821043000_validate_circuit_document_server_side.sql?raw'

describe('validação server-side de CircuitDocument', () => {
  it('declara helper privado, grants restritos e códigos estruturais', () => {
    expect(validationMigration).toContain('create or replace function private.veritas_validate_circuit_document(p_document jsonb)')
    expect(validationMigration).toContain('revoke all on function private.veritas_validate_circuit_document(jsonb) from public, anon, authenticated;')
    expect(validationMigration).toContain("'invalid-format'")
    expect(validationMigration).toContain("'unsupported-version'")
    expect(validationMigration).toContain("'missing-input'")
    expect(validationMigration).toContain("'duplicate-target-port'")
    expect(validationMigration).toContain("'cycle'")
  })

  it('valida portas, larguras, posição e feedback sequencial sem bloquear o contrato temporal', () => {
    expect(validationMigration).toContain("'invalid-source-port'")
    expect(validationMigration).toContain("'invalid-target-port'")
    expect(validationMigration).toContain("'width-mismatch'")
    expect(validationMigration).toContain("'invalid-position'")
    expect(validationMigration).toContain("'clock', 'dff', 'tff', 'delay'")
    expect(validationMigration).toContain('has_combinational_cycle')
  })

  it('chama a validação antes da inserção/update da RPC de sincronização', () => {
    const validationCall = validationMigration.indexOf('v_validation_issues := private.veritas_validate_circuit_document(p_document)')
    const firstInsert = validationMigration.indexOf('insert into public.veritas_circuit_projects')
    expect(validationCall).toBeGreaterThan(-1)
    expect(firstInsert).toBeGreaterThan(validationCall)
    expect(validationMigration).toContain("errcode = '22023'")
    expect(validationMigration).toContain('Invalid circuit document:')
  })
})
