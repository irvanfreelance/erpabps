export default function EmployeeLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Top Header skeleton */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-200">
        <div className="space-y-2">
          <div className="h-6 w-48 bg-gray-200 rounded-md"></div>
          <div className="h-4 w-32 bg-gray-100 rounded-md"></div>
        </div>
        <div className="h-9 w-24 bg-gray-200 rounded-xl"></div>
      </div>

      {/* Main Profile Skeleton Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="h-24 w-24 mx-auto rounded-full bg-gray-200"></div>
          <div className="h-5 w-3/4 mx-auto bg-gray-200 rounded"></div>
          <div className="h-4 w-1/2 mx-auto bg-gray-100 rounded"></div>
          <div className="pt-4 border-t border-gray-100 space-y-2.5">
            <div className="h-4 w-full bg-gray-100 rounded"></div>
            <div className="h-4 w-5/6 bg-gray-100 rounded"></div>
            <div className="h-4 w-4/6 bg-gray-100 rounded"></div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
          <div className="h-6 w-36 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-10 bg-gray-100 rounded-lg"></div>
            <div className="h-10 bg-gray-100 rounded-lg"></div>
            <div className="h-10 bg-gray-100 rounded-lg"></div>
            <div className="h-10 bg-gray-100 rounded-lg"></div>
          </div>
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div className="h-4 w-40 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-50 rounded-xl border border-gray-100"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

