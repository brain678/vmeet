'use client';

import dynamic from 'next/dynamic';
import { Box, Button, Text } from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { AttendanceData } from '@/types/attendance';
import { toast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';

// Dynamically import MeetingRoom component with no SSR to prevent hydration issues
const MeetingRoom = dynamic(() => import('../components/MeetingRoom'), {
    ssr: false
});

export default function MeetingRoomPage() {
    const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);    const handleSessionEnd = (data: AttendanceData) => {
        try {
            setAttendanceData(data);
        } catch (error) {
            console.error('Error handling session end:', error);
        }
    };

    useEffect(() => {
        if (attendanceData?.recordCount) {
            toast({
                title: "Attendance Stopped Successfully",
                description: `${attendanceData.recordCount} records saved.`,
                variant: "default",
                action: attendanceData.downloadUrl ? (
                    <ToastAction 
                        altText="Download attendance report" 
                        onClick={() => {
                            if (typeof window !== 'undefined' && attendanceData.downloadUrl) {
                                window.open(`${process.env.NEXT_PUBLIC_API_URL}${attendanceData.downloadUrl}`, "_blank");
                            }
                        }}
                    >
                        Download Report
                    </ToastAction>
                ) : undefined
            });
        }
    }, [attendanceData]);

    return (
        <div className="min-h-screen w-full">
            <MeetingRoom onSessionEnd={handleSessionEnd} />
        </div>
    );
}