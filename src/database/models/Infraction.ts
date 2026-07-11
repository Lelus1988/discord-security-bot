import mongoose, { Schema, Document, Model } from 'mongoose';
import { InfractionType } from '../../types';

export interface IInfraction extends Document {
  guildId: string;
  userId: string;
  moderatorId: string;
  type: InfractionType;
  reason: string;
  duration?: number;
  active: boolean;
  createdAt: Date;
}

const InfractionSchema = new Schema<IInfraction>(
  {
    guildId:     { type: String, required: true, index: true },
    userId:      { type: String, required: true, index: true },
    moderatorId: { type: String, required: true },
    type:        { type: String, required: true, enum: ['BAN','KICK','MUTE','WARN','UNMUTE','UNBAN'] },
    reason:      { type: String, default: 'No reason provided' },
    duration:    { type: Number, default: null },
    active:      { type: Boolean, default: true },
  },
  { timestamps: true }
);

InfractionSchema.index({ guildId: 1, userId: 1 });

export const InfractionModel: Model<IInfraction> = mongoose.model<IInfraction>('Infraction', InfractionSchema);
