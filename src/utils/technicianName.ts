export const getDisplayName = (rawName?: string): string => {
  if (!rawName) return '';
  return rawName.replace(/\s*\([^)]*\)\s*$/, '').trim();
};
