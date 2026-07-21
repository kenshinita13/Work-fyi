import { Skeleton } from "@/components/ui/skeleton";

export default function AiPlannerLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-8 w-48" />
      <Skeleton className="mt-8 h-10 w-full max-w-3xl" />
      <Skeleton className="mt-5 h-48 w-full max-w-3xl" />
    </div>
  );
}
