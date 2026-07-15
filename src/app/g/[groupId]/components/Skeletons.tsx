"use client";

export function DashboardSkeleton() {
  return (
    <div className="animate-fade-in">
      <div className="mb-3 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-[62px]" />)}
      </div>
      <div className="mb-2.5 flex gap-1.5">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-7 w-20 rounded-pill" />)}
      </div>
      <div className="mb-2.5 flex gap-2 overflow-hidden">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[62px] w-[110px] shrink-0" />)}
      </div>
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-[72px]" />)}
      </div>
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="flex animate-fade-in flex-col gap-2">
      {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-[72px]" />)}
    </div>
  );
}
