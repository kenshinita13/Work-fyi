import { Skeleton } from "@/components/ui/skeleton";

export default function TasksLoading() {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-8 w-40" />
      <Skeleton className="mt-7 h-14 w-full" />
      <Skeleton className="mt-3 h-16 w-full" />
      <div className="mt-5 grid gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}
