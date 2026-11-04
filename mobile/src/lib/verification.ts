import { router } from 'expo-router';
import { ApiError } from './api';

/**
 * Whether introductions need ID-checked travellers. Matches the API's ID_CHECK
 * setting; off until the feature launches, which hides the "Verify" prompts.
 * Build with EXPO_PUBLIC_ID_CHECK=required to show them.
 */
export const ID_CHECK_REQUIRED = process.env.EXPO_PUBLIC_ID_CHECK === 'required';

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
