import { Schema, model, Document, Types } from 'mongoose';

export interface ITeam extends Document {
  organizationId: Types.ObjectId;
  name: string;
  department: string;
  monthlyBudget: number;
  createdAt: Date;
}

const TeamSchema = new Schema<ITeam>({
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  department: { type: String, default: 'Engineering' },
  monthlyBudget: { type: Number, default: 250 },
  createdAt: { type: Date, default: Date.now }
});

export const Team = model<ITeam>('Team', TeamSchema);
