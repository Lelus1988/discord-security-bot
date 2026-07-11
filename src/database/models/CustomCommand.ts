import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICustomCommand extends Document {
  guildId: string;
  trigger: string;       // without prefix, lowercase, e.g. "rules"
  response: string;      // supports {user}, {server}, {memberCount} placeholders
  useEmbed: boolean;
  embedColor: string;    // hex string, e.g. "#5865F2"
  enabled: boolean;
  createdBy: string;     // Discord user ID
  uses: number;
  createdAt: Date;
  updatedAt: Date;
}

const CustomCommandSchema = new Schema<ICustomCommand>(
  {
    guildId:    { type: String, required: true, index: true },
    trigger:    { type: String, required: true, lowercase: true, trim: true },
    response:   { type: String, required: true },
    useEmbed:   { type: Boolean, default: false },
    embedColor: { type: String, default: '#5865F2' },
    enabled:    { type: Boolean, default: true },
    createdBy:  { type: String, required: true },
    uses:       { type: Number, default: 0 },
  },
  { timestamps: true }
);

CustomCommandSchema.index({ guildId: 1, trigger: 1 }, { unique: true });

export const CustomCommandModel: Model<ICustomCommand> = mongoose.model<ICustomCommand>('CustomCommand', CustomCommandSchema);
