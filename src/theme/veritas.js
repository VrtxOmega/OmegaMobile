// VERITAS Design System
export const colors = {
  obsidian: '#0A0A0C',
  obsidianLight: '#111118',
  obsidianMid: '#13131a',
  gold: '#D4AF37',
  goldDim: 'rgba(212, 175, 55, 0.4)',
  goldFaint: 'rgba(212, 175, 55, 0.15)',
  goldSelection: 'rgba(212, 175, 55, 0.2)',
  text: '#c8c8b4',
  textDim: 'rgba(200, 200, 180, 0.6)',
  textFaint: 'rgba(200, 200, 180, 0.35)',
  border: 'rgba(212, 175, 55, 0.2)',
  borderBright: 'rgba(212, 175, 55, 0.4)',
  green: '#4CAF50',
  greenDim: 'rgba(76, 175, 80, 0.2)',
  red: '#e74c3c',
  redDim: 'rgba(231, 76, 60, 0.2)',
  orange: '#e67e22',
  orangeDim: 'rgba(230, 126, 34, 0.2)',
  blue: '#3498db',
};

export const fonts = {
  mono: 'Courier New',
  sans: 'System',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const typography = {
  label: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.goldDim,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 4,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.goldDim,
    textTransform: 'uppercase',
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  bodySmall: {
    fontFamily: fonts.sans,
    fontSize: 11,
    color: colors.textDim,
  },
  code: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.text,
  },
};

export const shadows = {
  gold: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};
