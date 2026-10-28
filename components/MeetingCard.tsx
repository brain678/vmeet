"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import avatarImages, { type AvatarImage } from "../constants/avatarImages";
import { useToast } from "./ui/use-toast";

interface MeetingCardProps {
  title: string;
  date: string;
  icon: string;
  isPreviousMeeting?: boolean;
  buttonIcon1?: string;
  buttonText?: string;
  handleClick: () => void;
  link: string;
  description?: string;
}

const MeetingCard = ({
  icon,
  title,
  date,
  isPreviousMeeting = false,
  buttonIcon1,
  handleClick,
  link,
  buttonText = "Join Meeting",
  description,
}: MeetingCardProps) => {
  const { toast } = useToast();
  const [copyError, setCopyError] = useState(false);
  const [imageError, setImageError] = useState<{ [key: string]: boolean }>({});

  return (
    <section className="flex min-h-[258px] w-full flex-col justify-between rounded-[22px] border border-[#E6D8F4] bg-white px-4 py-6 shadow-[0_8px_18px_rgba(71,38,96,0.08)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_25px_rgba(71,38,96,0.12)] sm:px-5 sm:py-8 xl:max-w-[568px]">
      <article className="flex flex-col gap-4 sm:gap-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3EAFD] text-[#6E27AE] shadow-sm sm:h-[44px] sm:w-[44px]">
          <Image 
            src={icon} 
            alt={title}
            width={22}
            height={22}
            className="object-contain"
            onError={() => {
              toast({
                title: "Error",
                description: "Failed to load meeting icon",
                variant: "destructive"
              });
            }}
          />
        </div>
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <h1 className="text-xl font-bold text-[#2D1A3A] line-clamp-2 sm:text-2xl">{title}</h1>
            <p className="text-sm font-medium text-[#6B6171] sm:text-base">{date}</p>
            {description && (
              <p className="mt-1 text-xs leading-5 text-[#6B6171] sm:text-sm line-clamp-2">{description}</p>
            )}
          </div>
        </div>
      </article>

      <article className="mt-4 flex flex-col items-center justify-between gap-4 sm:mt-0 sm:flex-row sm:gap-6">
        <div className="order-2 w-full sm:order-1 sm:w-auto">
          <div className="flex justify-center sm:justify-start">
            {avatarImages.slice(0, 5).map((img: AvatarImage, index: number) => (
              <div
                key={img.url}
                className={cn("relative transition-transform duration-200 hover:-translate-y-1", {
                  "ml-0": index === 0,
                  "-ml-3": index > 0
                })}
                style={{ zIndex: 5 - index }}
              >
                <Image
                  src={!imageError[img.url] ? img.url : '/icons/avatar-placeholder.svg'}
                  alt={img.alt}
                  width={40}
                  height={40}
                  className={cn(
                    "rounded-full border-2 border-white transition-opacity",
                    imageError[img.url] ? "opacity-50" : "opacity-100"
                  )}
                  onError={() => {
                    setImageError(prev => ({ ...prev, [img.url]: true }));
                  }}
                />
              </div>
            ))}
            {avatarImages.length > 5 && (
              <div 
                className="relative flex h-10 w-10 -ml-3 items-center justify-center rounded-full bg-[#E9D9FF] text-sm font-semibold text-[#5D2A86] transition-transform duration-200 hover:-translate-y-1"
                style={{ zIndex: 0 }}
              >
                <span>+{avatarImages.length - 5}</span>
              </div>
            )}
          </div>
        </div>

        {!isPreviousMeeting && (
          <div className="order-1 flex w-full flex-col gap-2 sm:order-2 sm:w-auto sm:flex-row">
            <Button 
              onClick={handleClick} 
              className={cn(
                "w-full rounded-xl bg-[#6E27AE] px-4 py-2.5 text-sm font-semibold text-white sm:w-auto",
                "transition-all duration-200 hover:bg-[#5D1F94] hover:shadow-md",
                "disabled:bg-[#9E7FC9] disabled:cursor-not-allowed"
              )}
            >
              {buttonIcon1 && (
                <Image 
                  src={buttonIcon1} 
                  alt={buttonText || "Action"} 
                  width={20} 
                  height={20}
                  className="mr-2"
                />
              )}
              <span>{buttonText}</span>
            </Button>
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopyError(false);
                  toast({
                    title: "Success",
                    description: "Meeting link copied to clipboard",
                    variant: "default"
                  });
                } catch (err) {
                  setCopyError(true);
                  toast({
                    title: "Error",
                    description: "Failed to copy link. Please try again.",
                    variant: "destructive"
                  });
                }
              }}
              className={cn(
                "w-full rounded-xl border border-[#E6D8F4] bg-[#F7F1FF] px-4 py-2.5 text-sm font-semibold text-[#5D2A86] sm:w-auto",
                "transition-all duration-200 hover:bg-[#F0E5FF] hover:shadow-md",
                "disabled:cursor-not-allowed",
                { "bg-red-500/10 text-red-600 hover:bg-red-500/15": copyError }
              )}
            >
              <Image
                src={copyError ? "/icons/error.svg" : "/icons/copy.svg"}
                alt="Copy link to clipboard"
                width={20}
                height={20}
                className="mr-2"
              />
              <span>Copy Link</span>
            </Button>
          </div>
        )}
      </article>
    </section>
  );
};

export default MeetingCard;
