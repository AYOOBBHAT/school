/**
 * Responsive design utilities
 * Provides breakpoints and helper functions for responsive layouts
 */
export const breakpoints = {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
};
/**
 * Check if screen size matches breakpoint
 */
export const useMediaQuery = (query) => {
    if (typeof window === 'undefined')
        return false;
    return window.matchMedia(query).matches;
};
/**
 * Get responsive class names based on screen size
 */
export const getResponsiveClasses = (classes) => {
    return [
        classes.base,
        classes.sm && `sm:${classes.sm}`,
        classes.md && `md:${classes.md}`,
        classes.lg && `lg:${classes.lg}`,
        classes.xl && `xl:${classes.xl}`,
    ]
        .filter(Boolean)
        .join(' ');
};
/**
 * Responsive grid columns
 */
export const gridCols = {
    mobile: 'grid-cols-1',
    tablet: 'sm:grid-cols-2',
    desktop: 'md:grid-cols-3',
    wide: 'lg:grid-cols-4',
};
