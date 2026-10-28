'use client';

import { ReactNode, useEffect, useState } from 'react';
import { StreamVideoClient, StreamVideo } from '@stream-io/video-react-sdk';
import { useUser } from '@clerk/nextjs';

import { tokenProvider } from '@/app/actions/stream.actions';
import { BACKEND_URL } from '@/constants/config';
import Loader from '@/components/Loader';

const API_KEY = process.env.NEXT_PUBLIC_STREAM_API_KEY;

const StreamVideoProvider = ({ children }: { children: ReactNode }) => {
  const [videoClient, setVideoClient] = useState<StreamVideoClient>();
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;
    if (!API_KEY) throw new Error('Stream API key is missing');

    let cancelled = false;

    const createVideoClient = async () => {
      let backendName = '';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      try {
        const response = await fetch(`${BACKEND_URL}/get-user-role?userId=${user.id}`, { signal: controller.signal });
        if (response.ok) {
          const data = await response.json();
          backendName = typeof data.name === 'string' ? data.name.trim() : '';
        }
      } catch (error) {
        console.warn('Unable to load the backend display name:', error);
      } finally {
        clearTimeout(timeoutId);
      }

      if (cancelled) return;

      const displayName = backendName || user.fullName ||
        [user.firstName, user.lastName].filter(Boolean).join(' ') ||
        user.username ||
        user.id;

      const client = new StreamVideoClient({
        apiKey: API_KEY,
        user: {
          id: user.id,
          name: displayName,
          image: user.imageUrl,
        },
        tokenProvider,
      });

      setVideoClient(client);
    };

    createVideoClient().catch((error) => {
      console.error('Unable to initialize the Stream client:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [user, isLoaded]);

  if (!videoClient) return <Loader />;

  return <StreamVideo client={videoClient}>{children}</StreamVideo>;
};

export default StreamVideoProvider;
