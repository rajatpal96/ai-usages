import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
  organizationId: Types.ObjectId;
  teamId: Types.ObjectId;
  username: string; // e.g. OS username or Git committer email
  name: string;
  role: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
  username: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, default: 'Developer' },
  createdAt: { type: Date, default: Date.now }
});

export const User = model<IUser>('User', UserSchema);
