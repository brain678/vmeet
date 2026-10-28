"use client";

import { useUser } from "@clerk/nextjs";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useRouter } from "next/navigation";

import { useGetCallById } from "@/hooks/useGetCallById";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

const Table = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => {
  return (
    <div className="flex flex-col gap-2 border-b border-[#EEE3F9] pb-4 last:border-b-0 last:pb-0 xl:flex-row xl:items-center xl:justify-between">
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-[#6B6171]">
        {title}
      </h2>
      <p className="break-all text-base font-semibold text-[#2D1A3A] xl:max-w-[70%] xl:text-right">
        {description}
      </p>
    </div>
  );
};

const PersonalRoom = () => {
  const router = useRouter();
  const { user } = useUser();
  const client = useStreamVideoClient();
  const { toast } = useToast();

  const meetingId = user?.id;

  const { call } = useGetCallById(meetingId!);

  const startRoom = async () => {
    if (!client || !user) return;

    const newCall = client.call("default", meetingId!);

    if (!call) {
      await newCall.getOrCreate({
        data: {
          starts_at: new Date().toISOString(),
        },
      });
    }

    router.push(`/meeting/${meetingId}?personal=true`);
  };

  const meetingLink = `${process.env.NEXT_PUBLIC_BASE_URL}/meeting/${meetingId}?personal=true`;

  return (
    <section className="min-h-screen bg-[#F5EFFB] px-4 pb-10 pt-20 text-[#18121F] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-r from-[#7630B8] via-[#8234C6] to-[#A14EDD] px-5 py-6 text-white shadow-[0_12px_25px_rgba(99,44,148,0.22)] sm:rounded-[40px] sm:px-8 sm:py-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,255,255,0.14),_transparent_38%)]" />
          <div className="relative z-10">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">Workspace</p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">Personal Room</h1>
            <p className="mt-2 max-w-xl text-sm text-white/80 sm:text-base">
              Your dedicated meeting space for quick sessions, office hours, and private class invites.
            </p>
          </div>
        </div>

        <div className="mt-7 rounded-[28px] border border-[#E6D8F4] bg-white p-5 shadow-[0_8px_18px_rgba(71,38,96,0.08)] sm:p-7">
          <div className="flex w-full flex-col gap-6">
            <Table title="Topic" description={`${user?.username || 'Your'}'s Meeting Room`} />
            <Table title="Meeting ID" description={meetingId || 'Unavailable'} />
            <Table title="Invite Link" description={meetingLink} />
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button
              className="w-full rounded-xl bg-[#6E27AE] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#5D1F94] hover:shadow-md sm:w-auto"
              onClick={startRoom}
            >
              Start Meeting/Class
            </Button>
            <Button
              className="w-full rounded-xl border border-[#E6D8F4] bg-[#F7F1FF] px-4 py-2.5 text-sm font-semibold text-[#5D2A86] transition-all duration-200 hover:bg-[#F0E5FF] hover:shadow-md sm:w-auto"
              onClick={() => {
                navigator.clipboard.writeText(meetingLink);
                toast({
                  title: "Link Copied",
                  description: "Your personal room invite link has been copied.",
                });
              }}
            >
              Copy Invitation
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PersonalRoom;
