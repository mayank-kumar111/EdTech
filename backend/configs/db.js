import mongoose from "mongoose";

const connectDb = async () => {
    const mongoUrl = process.env.MONGODB_URL;

    if (!mongoUrl) {
        console.error(
            "MongoDB connection failed: MONGODB_URL is missing. Check backend/.env."
        );
        return false;
    }

    try {
        await mongoose.connect(mongoUrl, {
            serverSelectionTimeoutMS: 10000,
        });

        console.log("MongoDB connected successfully.");
        return true;
    } catch (error) {
        console.error("MongoDB connection failed:");
        console.error(error.message);
        return false;
    }
};

export default connectDb;
