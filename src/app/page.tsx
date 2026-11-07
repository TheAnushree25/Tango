import GoalsController from '@/components/home/GoalsController';
import Statistics from '@/components/home/Statistics';

export default function HomePage() {
  return (
    <main>
      <Statistics />
      <GoalsController />
    </main>
  );
}
