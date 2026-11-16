import { Spin } from '@arco-design/web-react';
import React from 'react';

export type AppLoaderProps = {
  /**
   * Paint an opaque, full-viewport backdrop behind the spinner.
   *
   * Only for loaders that stand in for the *entire* app (the boot gate), so
   * the window is never blank underneath. Leave it off for the `Suspense`
   * fallback, where the surrounding content is already painted and must stay
   * visible.
   */
  fullScreen?: boolean;
};

const AppLoader: React.FC<AppLoaderProps> = ({ fullScreen = false }) => {
  return (
    <div
      className={fullScreen ? 'min-h-screen bg-1' : undefined}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}
      data-testid={fullScreen ? 'app-loader-full-screen' : undefined}
    >
      <Spin dot />
    </div>
  );
};

export default AppLoader;
