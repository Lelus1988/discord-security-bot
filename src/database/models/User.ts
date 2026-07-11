import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  guildId: string;
  warnCount: number;
  isMuted: boolean;
  mutedUntil?: Date;
  notes: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    userId:     { type: String, required: true, index: true },
    guildId:    { type: String, required: true, index: true },
    warnCount:  { type: Number, default: 0 },
    isMuted:    { type: Boolean, default: false },
    mutedUntil: { type: Date,   default: null },
    notes:      { type: [String], default: [] },
  },
  { timestamps: true }
);

UserSchema.index({ userId: 1, guildId: 1 }, { unique: true });

export const UserModel: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
