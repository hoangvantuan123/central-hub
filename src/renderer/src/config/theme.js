export const getTheme = (isDark) => ({
  bg: isDark ? '#000000' : '#f1f5f9',
  panelBg: isDark ? '#0a0a0a' : '#ffffff',
  panelHeader: isDark ? '#0f1115' : '#e2e8f0',
  border: isDark ? '#262626' : '#cbd5e1',
  text: isDark ? '#e5e5e5' : '#0f172a',
  textMuted: isDark ? '#737373' : '#64748b',
  primary: isDark ? '#0ea5e9' : '#0284c7',
  primaryHover: isDark ? '#38bdf8' : '#0369a1',
  inputBg: isDark ? '#000000' : '#f8fafc',
  inputFocus: isDark ? '#050b14' : '#f0f9ff',
  tableHeader: isDark ? '#050505' : '#f8fafc',
  tableRowHover: isDark ? '#141414' : '#f1f5f9',
  success: isDark ? '#10b981' : '#059669',
  danger: isDark ? '#ef4444' : '#dc2626',
  warning: isDark ? '#eab308' : '#d97706',
  logBg: isDark ? '#000000' : '#1e1e1e',
  logText: isDark ? '#10b981' : '#a7f3d0'
})
