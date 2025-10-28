// Moonlit Psychiatry Design Tokens
// Centralized design system values for consistent branding

export const colors = {
  // Primary brand colors
  primary: {
    terracotta: '#E89C8A',      // Logo dots, accent elements
    terracottaLight: '#f3baa9',
    terracottaDark: '#d56f56',
  },
  navy: {
    main: '#0A1F3D',           // Headlines, primary text
    light: '#2d4165',
    lighter: '#4e5f7e',        // Secondary text
    lightest: '#6f7e97',       // Muted text
  },
  cream: {
    main: '#F5F1ED',           // Primary background
    light: '#fdfbf9',
    white: '#ffffff',          // Paper/card backgrounds
  },
  taupe: {
    main: '#C5A882',           // Primary buttons, CTAs
    light: '#ddd0bc',
    dark: '#a38654',
    darker: '#8b7147',
  },
  // Accent colors
  accent: {
    mint: '#D4F1E8',           // Success states
    mintLight: '#e5f7f1',
    coral: '#F5D6C8',          // Warning states
    coralLight: '#fae8e0',
    peach: '#F5C8B3',          // Highlights
  },
  // Status colors
  status: {
    success: '#D4F1E8',
    successDark: '#a8d6c3',
    warning: '#F5D6C8',
    warningDark: '#e2b8a4',
    error: '#d56f56',
    errorLight: '#f3baa9',
    info: '#98a3b5',
    infoLight: '#c1c8d3',
    pending: '#ede6dc',        // Light taupe
    processing: '#f8d4cc',     // Light terracotta
  },
  // Semantic colors
  text: {
    primary: '#0A1F3D',        // Navy
    secondary: '#4e5f7e',      // Lighter navy
    muted: '#6f7e97',          // Muted navy
    light: '#98a3b5',          // Light text
    inverse: '#ffffff',        // White text on dark backgrounds
  },
  background: {
    default: '#F5F1ED',        // Cream
    paper: '#ffffff',
    cream: '#F5F1ED',
    light: '#fdfbf9',
    hover: '#ede7e1',
  },
  border: {
    default: '#e0d7ce',        // Light cream border
    light: '#ede7e1',
    focus: '#C5A882',          // Taupe focus
  },
};

export const typography = {
  // Font families
  fontFamily: {
    serif: '"Baskerville", "Georgia", "Caslon", "Times New Roman", serif',
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    mono: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
  },
  // Font sizes
  fontSize: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.75rem',   // 28px
    '4xl': '2rem',      // 32px
    '5xl': '2.5rem',    // 40px
  },
  // Font weights
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  // Line heights
  lineHeight: {
    tight: 1.2,
    snug: 1.4,
    normal: 1.5,
    relaxed: 1.6,
    loose: 1.8,
  },
  // Letter spacing
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.01em',
  },
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
  '4xl': '64px',
  '5xl': '96px',
};

export const borderRadius = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  pill: '9999px',  // For badges and pills
  circle: '50%',
};

export const shadows = {
  xs: '0 1px 2px rgba(10, 31, 61, 0.04)',
  sm: '0 2px 4px rgba(10, 31, 61, 0.05)',
  md: '0 4px 8px rgba(10, 31, 61, 0.06)',
  lg: '0 8px 16px rgba(10, 31, 61, 0.08)',
  xl: '0 16px 32px rgba(10, 31, 61, 0.1)',
  // Warm shadows (with taupe tint)
  warmSm: '0 2px 4px rgba(197, 168, 130, 0.1)',
  warmMd: '0 4px 8px rgba(197, 168, 130, 0.15)',
  warmLg: '0 8px 16px rgba(197, 168, 130, 0.2)',
  // Card shadow
  card: '0 2px 8px rgba(10, 31, 61, 0.05)',
  cardHover: '0 4px 12px rgba(10, 31, 61, 0.08)',
};

export const transitions = {
  fast: '150ms ease',
  base: '250ms ease',
  slow: '350ms ease',
  // Specific transitions
  color: 'color 150ms ease',
  background: 'background-color 250ms ease',
  border: 'border-color 250ms ease',
  shadow: 'box-shadow 250ms ease',
  transform: 'transform 250ms ease',
  all: 'all 250ms ease',
};

export const breakpoints = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Component-specific tokens
export const components = {
  button: {
    primary: {
      background: colors.taupe.main,
      backgroundHover: colors.taupe.dark,
      color: colors.text.inverse,
      borderRadius: borderRadius.md,
      padding: `${spacing.md} ${spacing.xl}`,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
      shadow: 'none',
      shadowHover: shadows.warmMd,
    },
    secondary: {
      background: 'transparent',
      backgroundHover: colors.taupe.light + '20', // 20% opacity
      color: colors.taupe.main,
      border: `1.5px solid ${colors.taupe.main}`,
      borderHover: `1.5px solid ${colors.taupe.dark}`,
      borderRadius: borderRadius.md,
      padding: `${spacing.md} ${spacing.xl}`,
      fontSize: typography.fontSize.base,
      fontWeight: typography.fontWeight.medium,
    },
    disabled: {
      background: colors.border.default,
      color: colors.text.muted,
      opacity: 0.5,
    },
  },
  input: {
    background: colors.background.paper,
    backgroundFocus: colors.background.paper,
    border: `1px solid ${colors.border.default}`,
    borderFocus: `1px solid ${colors.taupe.main}`,
    borderRadius: borderRadius.md,
    padding: `${spacing.md} ${spacing.lg}`,
    fontSize: typography.fontSize.base,
    color: colors.text.primary,
    placeholderColor: colors.text.muted,
    shadow: 'none',
    shadowFocus: shadows.warmSm,
  },
  card: {
    background: colors.background.paper,
    borderRadius: borderRadius.lg,
    padding: spacing['2xl'],
    shadow: shadows.card,
    shadowHover: shadows.cardHover,
    border: `1px solid ${colors.border.light}`,
  },
  badge: {
    borderRadius: borderRadius.pill,
    padding: `${spacing.xs} ${spacing.md}`,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    // Status variants
    success: {
      background: colors.accent.mint,
      color: colors.navy.main,
    },
    warning: {
      background: colors.accent.coral,
      color: colors.navy.main,
    },
    error: {
      background: colors.status.error + '20', // 20% opacity
      color: colors.status.error,
    },
    info: {
      background: colors.status.info + '20', // 20% opacity
      color: colors.navy.main,
    },
    pending: {
      background: colors.status.pending,
      color: colors.navy.main,
    },
    processing: {
      background: colors.status.processing,
      color: colors.navy.main,
    },
  },
};

// Utility function to get WCAG contrast ratio
export const getContrastRatio = (foreground, background) => {
  // This is a placeholder - implement actual WCAG contrast calculation if needed
  return 4.5; // Minimum for WCAG AA
};

// Moonlit brand guidelines
export const brandGuidelines = {
  logoMinHeight: '32px',
  logoAspectRatio: '2.5:1',
  minTouchTarget: '44px',
  maxContentWidth: '1280px',
  sectionSpacing: spacing['5xl'],
  cardSpacing: spacing.xl,
  elementSpacing: spacing.lg,
};

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  breakpoints,
  components,
  brandGuidelines,
};