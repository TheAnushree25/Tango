import type { Metadata } from 'next';
import TextPage from '@/components/layout/TextPage';
import { ABOUT } from '@/lib/content';

export const metadata: Metadata = { title: 'The Last Tempo / About' };

export default function AboutPage() {
  return <TextPage content={ABOUT} />;
}
