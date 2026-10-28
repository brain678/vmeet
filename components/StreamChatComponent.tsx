

import React, { useEffect, useState } from 'react';
import { StreamChat, Channel as StreamChannel } from 'stream-chat';
import {
  Chat,
  Channel,
  ChannelHeader,
  MessageList,
  MessageInput,
  Thread,
  Window,
  LoadingIndicator,
} from 'stream-chat-react';
import 'stream-chat-react/dist/css/v2/index.css';
import './streamchat-custom.css';

const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY || '';


type StreamChatComponentProps = {
  userId: string;
  userName: string;
  callId: string;
  onClose?: () => void;
};

const StreamChatComponent: React.FC<StreamChatComponentProps> = ({ userId, userName, callId, onClose }) => {
  const [chatClient, setChatClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch Stream Chat token from Next.js API
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    fetch('/api/get-stream-chat-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch chat token');
        const data = await res.json();
        setUserToken(data.token);
      })
      .catch((err) => {
        console.error('[StreamChat] Failed to fetch token:', err);
        setError('Unable to load chat. Please try again later.');
        setLoading(false);
      });
  }, [userId]);

  // Initialize Stream Chat client and channel
  useEffect(() => {
    if (!userId || !userToken) return;
    const client = StreamChat.getInstance(apiKey);
    let mounted = true;
    client
      .connectUser(
        {
          id: userId,
          name: userName,
        },
        userToken
      )
      .then(async () => {
        const channelId = `call-${callId}`;
        const channel = client.channel('messaging', channelId, {
          members: [userId, 'host'],
        });
        await channel.watch();
        if (mounted) setChannel(channel);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[StreamChat] Failed to connect:', err);
        setError('Unable to connect to chat.');
        setLoading(false);
      });
    setChatClient(client);
    return () => {
      mounted = false;
      client.disconnectUser();
    };
  }, [userId, userToken, userName, callId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-[#232526] to-[#414345]">
        <LoadingIndicator />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-gradient-to-br from-[#232526] to-[#414345] text-red-400">
        {error}
      </div>
    );
  }

  if (!chatClient || !channel) return null;

  return (
    <div className="h-full w-full bg-gradient-to-br from-[#232526] to-[#414345] rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
      {/* Cancel/Close button */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-50 bg-[#232526] text-white rounded-full p-2 hover:bg-[#414345] shadow-lg focus:outline-none"
          aria-label="Cancel Chat"
        >
          {/* Cancel icon (circle with an X) */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
            <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <Chat client={chatClient} theme="str-chat__theme-dark">
        <Channel channel={channel}>
          <Window>
            <div className="str-chat__channel-header !bg-[#232526] !text-white !rounded-t-2xl !shadow-md">
              <ChannelHeader title="Meeting Chat" />
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <MessageList messageActions={['edit', 'delete', 'react']} />
            </div>
            <div className="p-2 bg-[#232526]">
              <div className="custom-message-input">
                <MessageInput focus Input={undefined} />
              </div>
            </div>
          </Window>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};

export default StreamChatComponent;
