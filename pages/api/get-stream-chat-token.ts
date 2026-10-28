import type { NextApiRequest, NextApiResponse } from 'next';
import { StreamChat } from 'stream-chat';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }


  // Use correct env variable names
  const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
  // Should be STREAM_SECRET, not STREAM_SECRET_KEY
  const apiSecret = process.env.STREAM_SECRET_KEY;
  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'Stream credentials not set' });
  }

  try {
    // Debug logging for troubleshooting
    console.log('API: Generating token for', userId, 'with key', apiKey);
    const serverClient = StreamChat.getInstance(apiKey, apiSecret);
    // Upsert both the current user and the 'host' user to ensure both exist in Stream
    await serverClient.upsertUsers([
      { id: userId, name: userId },
      { id: 'host', name: 'Host' }
    ]);

    const token = serverClient.createToken(userId);
    return res.status(200).json({ token });
  } catch (e: any) {
    console.error('API: Error generating token:', e);
    return res.status(500).json({ error: e.message || 'Token generation failed' });
  }
}
