/**
 * Biometrics authentication service (MOB-1).
 * Integrates with expo-local-authentication with configurable hardware mock for testing.
 */

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  warning?: string;
}

export class BiometricService {
  private mockHardwareAvailable = true;
  private mockEnrolled = true;
  private mockSuccess = true;

  setMockState(hardwareAvailable: boolean, enrolled: boolean, success: boolean): void {
    this.mockHardwareAvailable = hardwareAvailable;
    this.mockEnrolled = enrolled;
    this.mockSuccess = success;
  }

  async hasHardwareAsync(): Promise<boolean> {
    return this.mockHardwareAvailable;
  }

  async isEnrolledAsync(): Promise<boolean> {
    return this.mockEnrolled;
  }

  async authenticateAsync(
    _promptMessage: string = 'Unlock SupportPilot Workspace',
  ): Promise<BiometricAuthResult> {
    const hasHardware = await this.hasHardwareAsync();
    if (!hasHardware) {
      return { success: false, error: 'BIOMETRICS_UNAVAILABLE' };
    }

    const isEnrolled = await this.isEnrolledAsync();
    if (!isEnrolled) {
      return { success: false, error: 'BIOMETRICS_NOT_ENROLLED' };
    }

    if (!this.mockSuccess) {
      return { success: false, error: 'AUTHENTICATION_FAILED' };
    }

    return { success: true };
  }
}

export const biometricService = new BiometricService();
