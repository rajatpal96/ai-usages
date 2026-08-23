import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoMemoryServer: MongoMemoryServer | null = null;

export async function connectDB(): Promise<string> {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    console.log(`[DB] Connecting to configured MongoDB: ${uri}`);
    await mongoose.connect(uri);
    return uri;
  } else {
    console.log('[DB] No MONGODB_URI found in env. Spinning up zero-config MongoMemoryServer...');
    mongoMemoryServer = await MongoMemoryServer.create();
    const memUri = mongoMemoryServer.getUri();
    console.log(`[DB] Connected to In-Memory MongoDB: ${memUri}`);
    await mongoose.connect(memUri);
    return memUri;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
  }
}
