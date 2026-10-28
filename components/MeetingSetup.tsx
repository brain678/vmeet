'use client';
import { useEffect, useState } from 'react';
import {
  VideoPreview,
  useCall,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';

import Alert from './Alert';
import { Button } from './ui/button';
import { ArrowRight, CameraOff, MicOff, RefreshCw, Settings2 } from 'lucide-react';

const MeetingSetup = ({
  setIsSetupComplete,
}: {
  setIsSetupComplete: (value: boolean) => void;
}) => {
  const { useCallEndedAt, useCallStartsAt } = useCallStateHooks();
  const callStartsAt = useCallStartsAt();
  const callEndedAt = useCallEndedAt();
  const callTimeNotArrived = callStartsAt && new Date(callStartsAt) > new Date();
  const callHasEnded = !!callEndedAt;

  const call = useCall();

  if (!call) {
    throw new Error('useStreamCall must be used within a StreamCall component.');
  }

  const [isMicCamToggled, setIsMicCamToggled] = useState(false);

  useEffect(() => {
    if (isMicCamToggled) {
      call.camera.disable();
      call.microphone.disable();
    } else {
      call.camera.enable();
      call.microphone.enable();
    }
  }, [isMicCamToggled, call.camera, call.microphone]);

  if (callTimeNotArrived)
    return (
      <Alert
        title={`Your Meeting/Class has not started yet. It is scheduled for ${callStartsAt.toLocaleString()}`}
      />
    );

  if (callHasEnded)
    return (
      <Alert
        title="The call has been ended by the host"
        iconUrl="/icons/call-ended.svg"
      />
    );

  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center bg-[#F7F4F8] px-3 py-5 text-[#2D1A3A] sm:min-h-screen sm:px-6 sm:py-10">
      <div className="w-full max-w-[560px] min-w-0 space-y-4 rounded-[24px] border border-[#E8E0ED] bg-white p-3 shadow-[0_14px_35px_rgba(71,38,96,0.1)] sm:space-y-5 sm:rounded-[28px] sm:p-7">
        <div className="flex items-start justify-between gap-4 px-1">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8437C8]">Before you join</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#2D1A3A] sm:text-3xl">Setup</h1>
            <p className="mt-1 text-xs leading-5 text-[#6B6172] sm:text-sm">Check your camera and audio before entering the class.</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F0E5F8] text-[#8437C8]">
            <Settings2 className="h-5 w-5" />
          </div>
        </div>

        {/* Video Preview Container */}
        <div className="relative w-full overflow-hidden rounded-2xl border border-[#DCCCE7] bg-[#24152F] shadow-inner">
          <div className="relative aspect-[16/10] w-full overflow-hidden sm:aspect-[4/3]">
            <VideoPreview className="relative flex h-full w-full items-center justify-center bg-[#24152F] text-center object-cover [&_.str_video__video-preview__disabled-video-preview]:absolute [&_.str_video__video-preview__disabled-video-preview]:inset-0 [&_.str_video__video-preview__disabled-video-preview]:flex [&_.str_video__video-preview__disabled-video-preview]:items-center [&_.str_video__video-preview__disabled-video-preview]:justify-center [&_.str_video__video-preview__disabled-video-preview]:px-4 [&_.str_video__video-preview__disabled-video-preview]:text-center [&_.str_video__video-preview__no-camera-preview]:absolute [&_.str_video__video-preview__no-camera-preview]:inset-0 [&_.str_video__video-preview__no-camera-preview]:flex [&_.str_video__video-preview__no-camera-preview]:items-center [&_.str_video__video-preview__no-camera-preview]:justify-center [&_.str_video__video-preview__no-camera-preview]:px-4 [&_.str_video__video-preview__no-camera-preview]:text-center" />
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#24152F]/95 p-5 opacity-0 transition-opacity group-[.no-camera]:opacity-100 sm:p-8">
            <div className="flex max-w-[390px] flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E45D72]/15 text-[#FF9AAA]"><CameraOff className="h-6 w-6" /></div>
              <div>
                <h3 className="text-lg font-semibold text-white sm:text-xl">No Camera Detected</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">Please make sure your camera is connected and you have granted camera permissions. Check your browser settings if the issue persists.</p>
              </div>
              <Button 
                className="mt-1 h-10 rounded-lg bg-[#E45D72] px-4 font-semibold text-white hover:bg-[#C9475D]"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.location) {
                    window.location.reload();
                  }
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Camera
              </Button>
            </div>
          </div>
        </div>
      </div>

        {/* Controls Container */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            <label className="flex min-h-12 min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-[#E8E0ED] bg-[#F7F4F8] px-3 py-3 text-[#3B3045] sm:px-4">
              <input
                type="checkbox"
                checked={isMicCamToggled}
                onChange={(e) => setIsMicCamToggled(e.target.checked)}
                className="h-5 w-5 rounded border-[#B98BDC] accent-[#8437C8]"
              />
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium leading-5">
                <MicOff className="h-4 w-4 text-[#8437C8]" />
                Join with mic and camera off
              </span>
            </label>

          </div>

          <Button
            className="h-12 w-full rounded-xl bg-[#8437C8] px-8 text-base font-semibold text-white shadow-[0_8px_16px_rgba(132,55,200,0.2)] transition-colors hover:bg-[#6E27AE]"
            onClick={() => {
              call.join();
              setIsSetupComplete(true);
            }}
          >
            Join meeting <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MeetingSetup;
