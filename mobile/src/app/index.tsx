import { Redirect } from 'expo-router';
import { useSession } from '@/lib/session';

export default function Index() {
  const { mode } = useSession();
  if (mode === 'family') return <Redirect href="/home" />;
  if (mode === 'parent') return <Redirect href="/parent" />;
  return <Redirect href="/welcome" />;
}
