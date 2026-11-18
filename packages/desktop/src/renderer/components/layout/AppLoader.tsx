import { Spin } from '@arco-design/web-react';
import React, { useEffect } from 'react';

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

export type AppBootGateProps = {
  /** Whether the app may render yet (the signed-in state is known). */
  ready: boolean;
  /** Kicks off the settings load. Its result must NOT gate the first paint. */
  onLoadSettings: () => void;
  /** The application, shown once `ready`. */
  children: React.ReactNode;
};

/**
 * Gate the app's first paint on the signed-in state — and only on that.
 *
 * The settings load runs alongside the app rather than in front of it: it
 * goes to the backend, which after an account switch is a freshly started
 * process still warming up, so waiting for it leaves the window blank for
 * seconds. Everything that reads the settings corrects itself once they
 * arrive (i18n swaps language, the theme resolves, and `configService`
 * notifies its subscribers).
 */
const AppBootGate: React.FC<AppBootGateProps> = ({ ready, onLoadSettings, children }) => {
  useEffect(() => {
    if (!ready) return;
    onLoadSettings();
  }, [ready, onLoadSettings]);

  if (!ready) {
    // A blank window is indistinguishable from a crash.
    return <AppLoader fullScreen />;
  }

  return <>{children}</>;
};

export default AppLoader;
export { AppBootGate };
