"use client";
import { ReactNode } from "react";
import { Dialog, DialogContent } from "./ui/dialog";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import Image from "next/image";

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  className?: string;
  children?: ReactNode;
  handleClick?: () => void;
  buttonText?: string;
  instantMeeting?: boolean;
  image?: string;
  buttonClassName?: string;
  buttonIcon?: string;
}

const MeetingModal = ({
  isOpen,
  onClose,
  title,
  className,
  children,
  handleClick,
  buttonText,
  instantMeeting,
  image,
  buttonClassName,
  buttonIcon,
}: MeetingModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-[520px] flex-col gap-6 overflow-y-auto rounded-[24px] border border-[#E8E0ED] bg-white px-5 py-7 text-[#2D1A3A] shadow-[0_20px_55px_rgba(45,27,74,0.2)] sm:rounded-[28px] sm:px-8 sm:py-9">
        <div className="flex flex-col gap-6">
          {image && (
            <div className="flex justify-center">
              <Image src={image} alt="checked" width={72} height={72} />
            </div>
          )}
          <h1 className={cn("pr-8 text-2xl font-semibold leading-tight text-[#2D1A3A] sm:text-3xl", className)}>
            {title}
          </h1>
          {children}
          <Button
            className="h-11 w-full rounded-lg bg-[#8437C8] font-semibold text-white shadow-[0_6px_12px_rgba(132,55,200,0.2)] hover:bg-[#6E27AE] focus-visible:ring-2 focus-visible:ring-[#B98BDC] focus-visible:ring-offset-2"
            onClick={handleClick}
          >
            {buttonIcon && (
              <Image
                src={buttonIcon}
                alt="button icon"
                width={13}
                height={13}
              />
            )}{" "}
            &nbsp;
            {buttonText || "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingModal;
