import { describe, it, expect } from 'vitest';
import { classifyMigrationState, MigrationInspectionInput } from '../migrationClassifier';

describe('Migration State Classifier (P2.1 Requirements)', () => {
  it('classifies an empty database as EMPTY_DATABASE regardless of other flags', () => {
    const input: MigrationInspectionInput = {
      isEmptyDatabase: true,
      ledgerHas011: false,
      ledgerHasP21: false,
      structural011Passed: false,
      structuralP21Passed: false,
      unknownChecksCount: 0,
      failedChecksCount: 0,
    };
    expect(classifyMigrationState(input)).toBe('EMPTY_DATABASE');
  });

  it('classifies as MIGRATION_HISTORY_VERIFIED_011 only when client-write-protected ledger confirms 011 AND structural 011 passes', () => {
    const input: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: true,
      ledgerHasP21: false,
      ledgerClientWriteProtected: true,
      structural011Passed: true,
      structuralP21Passed: false,
      unknownChecksCount: 0,
      failedChecksCount: 0,
    };
    expect(classifyMigrationState(input)).toBe('MIGRATION_HISTORY_VERIFIED_011');
  });

  it('demotes to STRUCTURALLY_COMPATIBLE_WITH_011 if ledger exists but lacks client-write protection', () => {
    const input: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: true,
      ledgerHasP21: false,
      ledgerClientWriteProtected: false, // Untrusted or client-writable ledger
      structural011Passed: true,
      structuralP21Passed: false,
      unknownChecksCount: 0,
      failedChecksCount: 0,
    };
    // Ledger that can be modified by client roles cannot prove verified history
    expect(classifyMigrationState(input)).toBe('STRUCTURALLY_COMPATIBLE_WITH_011');
  });

  it('classifies as STRUCTURALLY_COMPATIBLE_WITH_011 when structural 011 passes but ledger is missing (direct psql)', () => {
    const input: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: false, // No ledger record from direct psql
      ledgerHasP21: false,
      structural011Passed: true,
      structuralP21Passed: false,
      unknownChecksCount: 0,
      failedChecksCount: 0,
    };
    // Structural inspection alone must NEVER produce MIGRATION_HISTORY_VERIFIED_*
    expect(classifyMigrationState(input)).toBe('STRUCTURALLY_COMPATIBLE_WITH_011');
  });

  it('preserves structural compatibility even if migration 007 data postcondition is FAIL or UNKNOWN', () => {
    const inputFail: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: false,
      ledgerHasP21: false,
      structural011Passed: true,
      structuralP21Passed: false,
      unknownChecksCount: 0,
      failedChecksCount: 0,
      dataPostcondition007: 'FAIL', // Legacy data exists in profiles.name
    };
    // Structural compatibility must NOT depend on data cleanup result!
    expect(classifyMigrationState(inputFail)).toBe('STRUCTURALLY_COMPATIBLE_WITH_011');

    const inputUnknown: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: false,
      ledgerHasP21: false,
      structural011Passed: true,
      structuralP21Passed: false,
      unknownChecksCount: 0,
      failedChecksCount: 0,
      dataPostcondition007: 'UNKNOWN', // Empty table or unreadable data
    };
    expect(classifyMigrationState(inputUnknown)).toBe('STRUCTURALLY_COMPATIBLE_WITH_011');
  });

  it('classifies as MIGRATION_HISTORY_VERIFIED_P2_1 when client-protected ledger confirms P2.1 AND structural P2.1 passes', () => {
    const input: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: true,
      ledgerHasP21: true,
      ledgerClientWriteProtected: true,
      structural011Passed: true,
      structuralP21Passed: true,
      unknownChecksCount: 0,
      failedChecksCount: 0,
    };
    expect(classifyMigrationState(input)).toBe('MIGRATION_HISTORY_VERIFIED_P2_1');
  });

  it('classifies as STRUCTURALLY_COMPATIBLE_WITH_P2_1 when structural P2.1 passes but ledger does not record P2.1 or is writable by client', () => {
    const input: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: true,
      ledgerHasP21: false, // e.g. 012 applied via direct psql -f without ledger insert
      structural011Passed: true,
      structuralP21Passed: true,
      unknownChecksCount: 0,
      failedChecksCount: 0,
    };
    // Structural inspection alone must NEVER produce MIGRATION_HISTORY_VERIFIED_*
    expect(classifyMigrationState(input)).toBe('STRUCTURALLY_COMPATIBLE_WITH_P2_1');
  });

  it('classifies as UNKNOWN_OR_INCONSISTENT_STATE when any structural check has status UNKNOWN', () => {
    const input: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: true,
      ledgerHasP21: false,
      structural011Passed: true,
      structuralP21Passed: false,
      unknownChecksCount: 1, // e.g. An unreadable catalog or permission issue
      failedChecksCount: 0,
    };
    expect(classifyMigrationState(input)).toBe('UNKNOWN_OR_INCONSISTENT_STATE');
  });

  it('classifies as UNKNOWN_OR_INCONSISTENT_STATE when any structural check fails', () => {
    const input: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: true, // ledger claims 011 was applied
      ledgerHasP21: false,
      structural011Passed: false, // but a required column or policy is missing!
      structuralP21Passed: false,
      unknownChecksCount: 0,
      failedChecksCount: 1,
    };
    expect(classifyMigrationState(input)).toBe('UNKNOWN_OR_INCONSISTENT_STATE');
  });

  it('classifies as UNKNOWN_OR_INCONSISTENT_STATE when database has partial or unrecognized tables', () => {
    const input: MigrationInspectionInput = {
      isEmptyDatabase: false,
      ledgerHas011: false,
      ledgerHasP21: false,
      structural011Passed: false,
      structuralP21Passed: false,
      unknownChecksCount: 0,
      failedChecksCount: 0,
    };
    expect(classifyMigrationState(input)).toBe('UNKNOWN_OR_INCONSISTENT_STATE');
  });
});
