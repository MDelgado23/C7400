import { render, act } from '@testing-library/react-native';
import { SplashScreen } from '../SplashScreen';

describe('SplashScreen', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders the app logo', async () => {
    const view = await render(<SplashScreen onFinish={jest.fn()} />);
    expect(view.getByLabelText('LU32')).toBeTruthy();
  });

  it('does not call onFinish before the animation completes', async () => {
    const onFinish = jest.fn();
    await render(<SplashScreen onFinish={onFinish} durationMs={1800} />);
    await act(async () => {
      jest.advanceTimersByTime(1799);
    });
    expect(onFinish).not.toHaveBeenCalled();
  });

  it('calls onFinish exactly once when the animation completes', async () => {
    const onFinish = jest.fn();
    await render(<SplashScreen onFinish={onFinish} durationMs={1800} />);
    await act(async () => {
      jest.advanceTimersByTime(1800);
    });
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('does not call onFinish if unmounted before completion', async () => {
    const onFinish = jest.fn();
    const view = await render(
      <SplashScreen onFinish={onFinish} durationMs={1800} />,
    );
    await act(async () => {
      view.unmount();
    });
    await act(async () => {
      jest.advanceTimersByTime(1800);
    });
    expect(onFinish).not.toHaveBeenCalled();
  });
});
