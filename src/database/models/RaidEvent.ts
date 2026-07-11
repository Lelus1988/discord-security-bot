import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRaidEvent extends Document {
  guildId: string;
  startTime: Date;
  endTime?: Date;
  joinCount: number;
  triggered: boolean;
  bannedUsers: string[];
  createdAt: Date;
}

const RaidEventSchema = new Schema<IRaidEvent>(
  {
    guildId:     { type: String, required: true, index: true },
    startTime:   { type: Date,   required: true },
    endTime:     { type: Date,   default: null },
    joinCount:   { type: Number, default: 0 },
    triggered:   { type: Boolean, default: false },
    bannedUsers: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const RaidEventModel: Model<IRaidEvent> = mongoose.model<IRaidEvent>('RaidEvent', RaidEventSchema);
