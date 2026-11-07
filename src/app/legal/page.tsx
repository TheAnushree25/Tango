import type { Metadata } from 'next';
import TextPage from '@/components/layout/TextPage';
import { LEGAL } from '@/lib/content';

export const metadata: Metadata = { title: 'The Last Tempo / Legal notice' };

export default function LegalPage() {
  return <TextPage content={LEGAL} />;
}
