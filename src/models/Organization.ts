import { Schema, model, Document } from 'mongoose';

export interface IOrganization extends Document {
  name: string;
  monthlyBudget: number;
  createdAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>({
  name: { type: String, required: true, unique: true },
  monthlyBudget: { type: Number, default: 1000 },
  createdAt: { type: Date, default: Date.now }
});

export const Organization = model<IOrganization>('Organization', OrganizationSchema);
