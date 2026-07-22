import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Skeleton className="h-9 w-44" />
      <Skeleton className="mt-7 h-80 w-full rounded-md" />
    </div>
  );
}
