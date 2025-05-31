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
}: MeetingCardProps) => {
  const { toast } = useToast();
  const [copyError, setCopyError] = useState(false);
  const [imageError, setImageError] = useState<{ [key: string]: boolean }>({});

  return (
    <section className="flex min-h-[258px] w-full flex-col justify-between rounded-[14px] bg-dark-1 px-4 sm:px-5 py-6 sm:py-8 xl:max-w-[568px] transition-transform hover:scale-[1.02] hover:shadow-lg">
      <article className="flex flex-col gap-4 sm:gap-5">
        <div className="relative w-7 h-7 sm:w-[28px] sm:h-[28px]">
          <Image 
            src={icon} 
            alt={title}
            fill
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
            <h1 className="text-xl sm:text-2xl font-bold line-clamp-2">{title}</h1>
            <p className="text-sm sm:text-base font-normal text-gray-300">{date}</p>
          </div>
        </div>
      </article>

      <article className="flex flex-col sm:flex-row justify-between items-center gap-4 sm:gap-6 mt-4 sm:mt-0">
        <div className="w-full sm:w-auto order-2 sm:order-1">
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
                    "rounded-full border-2 border-dark-1 transition-opacity",
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
                className="relative flex items-center justify-center rounded-full bg-blue-1 w-10 h-10 -ml-3 transition-transform duration-200 hover:-translate-y-1"
                style={{ zIndex: 0 }}
              >
                <span className="text-sm text-white font-medium">+{avatarImages.length - 5}</span>
              </div>
            )}
          </div>
        </div>

        {!isPreviousMeeting && (
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
            <Button 
              onClick={handleClick} 
              className={cn(
                "rounded bg-blue-1 px-4 sm:px-6 py-2 w-full sm:w-auto",
                "transition-all duration-200 hover:bg-blue-600 hover:shadow-md",
                "disabled:bg-blue-800 disabled:cursor-not-allowed"
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
                "bg-dark-4 px-4 sm:px-6 py-2 w-full sm:w-auto",
                "transition-all duration-200 hover:bg-dark-3 hover:shadow-md",
                "disabled:bg-dark-5 disabled:cursor-not-allowed",
                { "bg-red-500/10 hover:bg-red-500/20": copyError }
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
