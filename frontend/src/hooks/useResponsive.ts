import { useWindowDimensions, Platform } from 'react-native';

export function useResponsive() {
  const { width, height } = useWindowDimensions();
  
  const isDesktop = width >= 1024;
  const isTablet = width >= 768 && width < 1024;
  const isMobile = width < 768;
  
  const contentMaxWidth = isDesktop ? 1200 : isTablet ? 768 : width;
  const cardWidth = isDesktop ? 'calc(50% - 8px)' : '100%';
  
  const containerPadding = isDesktop ? 32 : isTablet ? 24 : 16;
  
  return {
    width,
    height,
    isDesktop,
    isTablet,
    isMobile,
    contentMaxWidth,
    containerPadding,
    isWeb: Platform.OS === 'web',
  };
}

export const BREAKPOINTS = {
  mobile: 768,
  tablet: 1024,
  desktop: 1200,
};
