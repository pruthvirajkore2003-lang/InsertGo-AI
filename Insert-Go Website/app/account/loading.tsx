// The page is gated on a session lookup (Postgres round-trip) before anything
// renders, so navigations here would otherwise hang on the previous route.
//
// The blocks below mirror the real card's boxes one-for-one — heading, five
// rows, two buttons — so the swap to live content shifts nothing (CLS). A
// skeleton that is the wrong shape trades a hang for a jump.
export default function AccountLoading() {
  return (
    <main
      className="flex min-h-screen items-center justify-center px-5 pt-28 pb-16"
      aria-busy="true"
      aria-label="Loading your account"
    >
      <div className="w-full max-w-[480px]">
        <div className="glass-panel rounded-[28px] p-8 sm:p-10">
          <div className="skeleton h-8 w-44 rounded-lg" />
          <div className="mt-6 flex flex-col gap-4">
            <div className="skeleton h-[50px] rounded-2xl" />
            <div className="skeleton h-[50px] rounded-2xl" />
            <div className="skeleton h-[50px] rounded-2xl" />
            {/* daily-credits row is taller — it carries the meter and caption */}
            <div className="skeleton h-[88px] rounded-2xl" />
            <div className="skeleton h-[50px] rounded-2xl" />
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <div className="skeleton h-11 rounded-3xl" />
            <div className="skeleton h-11 rounded-3xl" />
          </div>
        </div>
      </div>
    </main>
  );
}
