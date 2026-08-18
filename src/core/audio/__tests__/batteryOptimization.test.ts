import { Platform } from 'react-native';
import {
  batteryOptimizationData,
  requestIgnoreBatteryOptimizations,
  __resetBatteryOptimizationGuard,
} from '../batteryOptimization';

jest.mock('expo-intent-launcher', () => ({
  ActivityAction: { REQUEST_IGNORE_BATTERY_OPTIMIZATIONS: 'REQUEST_IGNORE' },
  startActivityAsync: jest.fn(async () => ({ resultCode: -1 })),
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { android: { package: 'ar.com.lu32.radio' } } },
}));

import { startActivityAsync } from 'expo-intent-launcher';

const setPlatform = (os: 'android' | 'ios') => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
};

describe('batteryOptimizationData (pure)', () => {
  it('builds the package-scoped intent data URI for the given app id', () => {
    expect(batteryOptimizationData('ar.com.lu32.radio')).toBe(
      'package:ar.com.lu32.radio',
    );
  });
});

describe('requestIgnoreBatteryOptimizations (impure, guarded)', () => {
  beforeEach(() => {
    __resetBatteryOptimizationGuard();
    (startActivityAsync as jest.Mock).mockClear();
  });

  it('is a no-op on iOS (no Doze equivalent) and never launches an intent', async () => {
    setPlatform('ios');
    await expect(requestIgnoreBatteryOptimizations()).resolves.toBe('unsupported');
    expect(startActivityAsync).not.toHaveBeenCalled();
  });

  it('launches the REQUEST_IGNORE intent targeting this app on Android', async () => {
    setPlatform('android');
    await expect(requestIgnoreBatteryOptimizations()).resolves.toBe('requested');
    expect(startActivityAsync).toHaveBeenCalledWith('REQUEST_IGNORE', {
      data: 'package:ar.com.lu32.radio',
    });
  });

  it('only prompts once per session — a second auto call does not re-launch', async () => {
    setPlatform('android');
    await requestIgnoreBatteryOptimizations();
    await requestIgnoreBatteryOptimizations();
    expect(startActivityAsync).toHaveBeenCalledTimes(1);
  });

  it('re-launches on an explicit force call even after a prior prompt', async () => {
    // The in-app "Activar" banner is an explicit user action: it must always
    // open the system dialog, bypassing the once-per-session auto guard.
    setPlatform('android');
    await requestIgnoreBatteryOptimizations();
    await requestIgnoreBatteryOptimizations({ force: true });
    expect(startActivityAsync).toHaveBeenCalledTimes(2);
  });
});
