import { Injectable, signal } from '@angular/core';
import { BiometricAuth, BiometryError } from '@aparajita/capacitor-biometric-auth';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly unlocked = signal(false);

  async tryUnlock(): Promise<boolean> {
    // In browser/dev: altijd unlocked
    if (!Capacitor.isNativePlatform()) {
      this.unlocked.set(true);
      return true;
    }

    const info = await BiometricAuth.checkBiometry();
    if (!info.isAvailable) {
      // Geen biometrics beschikbaar — PIN-fallback (later)
      this.unlocked.set(true);
      return true;
    }

    try {
      await BiometricAuth.authenticate({
        reason: 'Log in op Prospero',
        cancelTitle: 'Annuleren',
        allowDeviceCredential: true,
      });
      this.unlocked.set(true);
      return true;
    } catch (e) {
      if (e instanceof BiometryError) {
        console.warn('Biometric auth mislukt:', e.message);
      }
      return false;
    }
  }

  lock(): void {
    this.unlocked.set(false);
  }
}
