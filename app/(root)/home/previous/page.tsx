import CallList from "@/components/CallList";

const PreviousPage = () => {
  return (
    <section className="min-h-screen bg-[#F5EFFB] px-4 pb-10 pt-20 text-[#18121F] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#7630B8] via-[#8234C6] to-[#A14EDD] px-5 py-6 text-white shadow-[0_12px_25px_rgba(99,44,148,0.22)] sm:rounded-[40px] sm:px-8 sm:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.14),_transparent_38%)]" />
          <div className="relative z-10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">History</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">Previous Calls</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
              Review past sessions, missed classes, and any completed meetings from your schedule.
            </p>
          </div>
        </div>

        <div className="mt-7">
          <CallList type="ended" />
        </div>
      </div>
    </section>
  );
};

export default PreviousPage;
