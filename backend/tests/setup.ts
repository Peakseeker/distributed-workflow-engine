import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

export async function connectTestDatabase() {
  const testUri = process.env.TEST_MONGODB_URI;

  if (!testUri) {
    throw new Error("TEST_MONGODB_URI is not configured in .env");
  }

  await mongoose.connect(testUri);
}

export async function disconnectTestDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}
