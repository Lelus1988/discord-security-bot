import mongoose, { Schema, Document, Model } from 'mongoose';
import { LogType } from '../../types';

export interface ILog extends Document {
  guildId: string;
  type: LogType;
  message: string;
  authorId?: string;
  createdAt: Date;
}

const LogSchema = new Schema<ILog>(
  {
    guildId:  { type: String, required: true, index: true },
    type:     { type: String, required: true, enum: ['INFO','WARN','SECURITY','RAID','SPAM','MOD'] },
    message:  { type: String, required: true },
    authorId: { type: String, default: null, index: true },
  },
  { timestamps: true }
);

export const LogModel: Model<ILog> = mongoose.model<ILog>('Log', LogSchema);
