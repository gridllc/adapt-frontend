import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * A headless component that scrolls the window to the top on every route change.
 * This ensures users don't start on a new page scrolled down.
 */
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
