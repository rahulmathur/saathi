import { router } from 'expo-router';
import { ApiError } from './api';

/**
 * Introductions need both travellers verified. When the server says this one
 * is not, take the family straight to the verification screen. Returns true
 * when it handled the error.
 */
export function goVerifyIfRequired(e: unknown): boolean {
  if (e instanceof ApiError && e.code === 'verification_required' && e.travellerId) {
    router.push(`/traveller/verify?id=${e.travellerId}`);
    return true;
  }
  return false;
}
